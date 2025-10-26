import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

interface HaltData {
  symbol: string;
  haltDate: string;
  haltTime: string;
  issueName: string;
  market: string;
  reasonCodes: string;
  pauseThresholdPrice: string;
  resumptionDate: string;
  resumptionQuoteTime: string;
}

export async function GET() {
  try {
    const halts = await fetchNasdaqHalts();
    
    return NextResponse.json({
      success: true,
      halts,
      count: halts.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error fetching halts:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('AbortError');
    
    return NextResponse.json(
      { 
        success: false, 
        error: isTimeout ? 
          'NASDAQ API timeout - the service may be experiencing high load. Please try again.' : 
          `Failed to fetch halt data: ${errorMessage}`,
        halts: [],
        errorType: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        retryAfter: isTimeout ? 30 : 10 // seconds
      },
      { status: isTimeout ? 503 : 500 }
    );
  }
}

async function fetchNasdaqHalts(): Promise<HaltData[]> {
  const url = "https://www.nasdaqtrader.com/RPCHandler.axd";
  
  const headers = {
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/json",
    "origin": "https://www.nasdaqtrader.com",
    "referer": "https://www.nasdaqtrader.com/trader.aspx?id=tradehalts",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin"
  };

  const payload = JSON.stringify({
    id: 2,
    method: "BL_TradeHalt.GetTradeHalts",
    params: "[]",
    version: "1.1"
  });

  // Enhanced retry logic with better timeout and error handling
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let controller: AbortController | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} to fetch NASDAQ halts`);
      
      controller = new AbortController();
      
      // Reduced timeout to fail faster
      const timeoutMs = 8000; // 8 second timeout
      timeoutId = setTimeout(() => {
        console.log(`⏰ Request timeout after ${timeoutMs}ms on attempt ${attempt}`);
        controller?.abort();
      }, timeoutMs);

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: payload,
        signal: controller.signal,
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get the raw response text first to handle JSON parsing errors
      const responseText = await response.text();
      
      console.log(`✅ Successfully fetched NASDAQ data on attempt ${attempt}`);
      console.log('Response length:', responseText.length);
      console.log('Response preview:', responseText.substring(0, 500));
      
      // Try to parse JSON with better error handling
      let json;
      try {
        json = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.log('Raw response that failed to parse:', responseText.substring(0, 1000));
        
        // Try to clean the response text and parse again
        const cleanedText = responseText.trim();
        
        // Find the first { and last } to extract just the JSON part
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonPart = cleanedText.substring(firstBrace, lastBrace + 1);
          console.log('Attempting to parse cleaned JSON...');
          json = JSON.parse(jsonPart);
        } else {
          throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : parseError}`);
        }
      }
      
      let html = json.result;
      console.log('Raw HTML preview:', html ? html.substring(0, 200) : 'No result in JSON');
      
      // Escape bare ampersands to make HTML XML-compliant
      html = html.replace(/&(?![a-zA-Z0-9#]+;)/g, '&amp;');
      
      return parseNasdaqTable(html);

    } catch (error) {
      // Clean up timeout if still active
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      lastError = error as Error;
      const errorType = error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
      console.log(`❌ Attempt ${attempt} failed (${errorType}):`, error instanceof Error ? error.message : error);
      
      if (attempt < maxRetries) {
        // Shorter delays for faster fallback: 1s, 2s
        const delay = attempt * 1000;
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // If all retries failed, return empty array with warning instead of throwing
  console.warn(`⚠️ All attempts to fetch NASDAQ halts failed. Returning empty halts list.`);
  console.warn(`Last error: ${lastError?.message}`);
  
  // Return empty array instead of throwing - this prevents the entire API from failing
  return [];
}

function parseNasdaqTable(html: string): HaltData[] {
  try {
    // Load the HTML using cheerio similar to your original XML parsing approach
    const $ = cheerio.load(`<root>${html}</root>`);
    
    // Find the table element
    const table = findTableElement($);
    if (!table || !table.length) {
      console.log("No table found in response");
      return [];
    }

    const rows = table.find("tr");
    if (rows.length === 0) {
      console.log("No rows found in table");
      return [];
    }

    // Get headers from first row
    const headers: string[] = [];
    rows.first().find("th").each((_: number, th: any) => {
      headers.push($(th).text().trim());
    });

    console.log("Found headers:", headers);

    // Get today's date in MM/DD/YYYY format
    const today = new Date();
    const todayFormatted = `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}/${today.getFullYear()}`;
    console.log("Looking for halt date:", todayFormatted);

    const data: HaltData[] = [];

    // Process data rows (skip header row)
    for (let i = 1; i < rows.length; i++) {
      const row = rows.eq(i);
      const cells = row.find("td");
      
      if (cells.length === 0) continue;

      const rowData: any = {};
      let isToday = false;

      cells.each((j: number, cell: any) => {
        const headerName = headers[j];
        if (!headerName) return;

        const cellValue = $(cell).text().trim();

        if (headerName === "Halt Date") {
          if (cellValue === todayFormatted) {
            isToday = true;
          }
        }

        // Special handling for reason codes (column 5 in your original code)
        if (j === 5) {
          const divs = $(cell).find("div");
          const reasons: string[] = [];
          divs.each((_: number, div: any) => {
            const a = $(div).find("a");
            if (a.length > 0) {
              const reason = a.text().trim();
              if (reason) reasons.push(reason);
            }
          });
          rowData[headerName] = reasons.length > 0 ? reasons.join(", ") : cellValue;
        } else {
          rowData[headerName] = cellValue;
        }
      });

      // Only add rows where Halt Date matches today
      if (isToday && rowData["Issue Symbol"]) {
        // Map according to the actual header structure we found:
        // ['Halt Date', 'Halt Time', 'Issue Symbol', 'Issue Name', 'Market', 'Reason Codes', 'Pause Threshold Price', 'Resumption Date', 'Resumption Quote Time', 'Resumption Trade Time']
        data.push({
          symbol: rowData["Issue Symbol"] || "N/A",
          haltDate: rowData["Halt Date"] || "N/A", 
          haltTime: rowData["Halt Time"] || "N/A",
          issueName: rowData["Issue Name"] || "N/A",
          market: rowData["Market"] || "N/A",
          reasonCodes: rowData["Reason Codes"] || "N/A",
          pauseThresholdPrice: rowData["Pause Threshold Price"] || "N/A",
          resumptionDate: rowData["Resumption Date"] || "N/A",
          resumptionQuoteTime: rowData["Resumption Quote Time"] || "N/A"
        });
      }
    }

    console.log(`Found ${data.length} halts for today`);
    return data;

  } catch (error) {
    console.error("Error parsing NASDAQ table:", error);
    return [];
  }
}

function findTableElement($: cheerio.CheerioAPI): any {
  // Find table in the root or nested elements
  let table = $("table").first();
  if (table.length > 0) return table;
  
  // Search recursively in nested elements
  const searchTable = (element: any): any => {
    if (element.is("table")) return element;
    
    const children = element.children();
    for (let i = 0; i < children.length; i++) {
      const result = searchTable(children.eq(i));
      if (result) return result;
    }
    return null;
  };

  return searchTable($("root"));
}
