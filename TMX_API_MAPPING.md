# TMX PowerStream API Parameter Mapping Documentation

## Overview

This document provides the exact API parameter mappings discovered by analyzing the TMX PowerStream web interface at https://tmxpowerstream.com/powerStreamWeb.php through network request capture.

---

## API Endpoint

**Base URL**: `https://app.quotemedia.com/datatool/getMarketStats.json`

**Method**: GET

**Authentication Required**: Yes (via SID + datatool-token)

---

## Query Parameters

### Required Parameters

| Parameter | Description | Possible Values | Example |
|-----------|-------------|-----------------|---------|
| `marketSession` | Market trading session | `NORMAL`, `PRE`, `POST` | `NORMAL` |
| `pathName` | Category path identifier | `/marketmovers/`, `/marketindices/`, etc. | `/marketmovers/` |
| `qmodTool` | Tool/Category name | `MarketMovers`, `MarketIndices`, etc. | `MarketMovers` |
| `sid` | Session ID | Format: `{wmid}-{timestamp}-{counter}` | `101020-1764616091217-1` |
| `stat` | Data type/statistic | `pl`, `pg`, `dv`, `va`, `dg`, `dl` | `pl` |
| `statExchange` | Stock exchange filter | `NSD`, `NYE`, `AMX`, `OTO`, `US` | `NSD` |
| `statCountry` | Country filter | `US`, etc. | `US` |
| `statTop` | Number of results | `25`, `50`, `100`, `250`, `500` | `100` |
| `timezone` | Include timezone info | `true`, `false` | `true` |
| `webmasterId` | Webmaster identifier | `101020` (TMX default) | `101020` |

### Optional Parameters

| Parameter | Description | When Used | Example |
|-----------|-------------|-----------|---------|
| `premarket` | Enable premarket data | When `marketSession=PRE` | `true` |

---

## Parameter Value Mappings

### 1. Market Session (`marketSession`)

| UI Display | Parameter Value | Description |
|-----------|-----------------|-------------|
| Market Hours / Normal Hours | `NORMAL` | Regular trading hours |
| Pre-Market | `PRE` | Before market opens |
| Post-Market / After-Hours | `POST` | After market closes |

### 2. Market Category (`qmodTool` + `pathName`)

| UI Display | qmodTool | pathName | Description |
|-----------|----------|----------|-------------|
| Market Overview | `MarketOverview` | `/marketoverview/` | Market summary |
| Market Indices | `MarketIndices` | `/marketindices/` | Index data |
| **Market Movers** | `MarketMovers` | `/marketmovers/` | Top movers (default) |
| Market Performers | `MarketPerformers` | `/marketperformers/` | Performance stats |
| Market Heatmaps | `MarketHeatmaps` | `/marketheatmaps/` | Visual heatmaps |
| Market Forex | `MarketForex` | `/marketforex/` | Currency pairs |
| Market Rates | `MarketRates` | `/marketrates/` | Interest rates |
| Market Calendars | `MarketCalendars` | `/marketcalendars/` | Economic calendar |
| Market Options | `MarketOptions` | `/marketoptions/` | Options data |
| Market Industries | `MarketIndustries` | `/marketindustries/` | Industry sectors |
| Market Constituents | `MarketConstituents` | `/marketconstituents/` | Index constituents |
| Market Filings | `MarketFilings` | `/marketfilings/` | SEC filings |

### 3. Data Type / Statistic (`stat`)

| UI Display | Parameter Value | Description |
|-----------|-----------------|-------------|
| Most Active / Volume Active | `va` | Highest trading volume |
| Dollar Volume | `dv` | Highest dollar volume |
| Dollar Gainers | `dg` | Largest dollar gains |
| Dollar Losers | `dl` | Largest dollar losses |
| Percent Gainers | `pg` | Largest percentage gains |
| **Percent Losers** | `pl` | Largest percentage losses (default in TMX) |

### 4. Exchange Filter (`statExchange`)

| UI Display | Parameter Value | Full Name |
|-----------|-----------------|-----------|
| All US Markets | `US` | All listed exchanges |  
| **NASDAQ** | `NSD` | NASDAQ Stock Market (default) |
| NYSE | `NYE` | New York Stock Exchange |
| NYSE American | `AMX` | NYSE American |
| OTC Markets | `OTO` | Over-the-counter |

### 5. Results Count (`statTop`)

| UI Display | Parameter Value |
|-----------|-----------------|
| Top 25 | `25` |
| Top 50 | `50` |
| **Top 100** | `100` (default) |
| Top 250 | `250` |
| Top 500 | `500` |

---

## Example Requests

### Example 1: Market Movers - Percent Losers - NASDAQ - Top 100

```
GET https://app.quotemedia.com/datatool/getMarketStats.json?marketSession=NORMAL&pathName=/marketmovers/&qmodTool=MarketMovers&sid=101020-1764616091217-1&stat=pl&statExchange=NSD&statCountry=US&statTop=100&timezone=true&webmasterId=101020
```

### Example 2: Market Movers - Dollar Volume - NYSE - Top 100

```
GET https://app.quotemedia.com/datatool/getMarketStats.json?marketSession=NORMAL&pathName=/marketmovers/&qmodTool=MarketMovers&sid=101020-1764616091217-1&stat=dv&statExchange=NYE&statCountry=US&statTop=100&timezone=true&webmasterId=101020
```

### Example 3: Pre-Market - Most Active - All Markets - Top 50

```
GET https://app.quotemedia.com/datatool/getMarketStats.json?marketSession=PRE&pathName=/marketmovers/&qmodTool=MarketMovers&premarket=true&sid=101020-1764616091217-1&stat=va&statExchange=US&statCountry=US&statTop=50&timezone=true&webmasterId=101020
```

---

## Request Headers

### Required Headers

```
datatool-token: {generated_token}
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36
Origin: https://qrm.quotemedia.com
Referer: https://qrm.quotemedia.com/
Accept: */*
Accept-Encoding: gzip, deflate, br, zstd
Accept-Language: en
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-site
```

---

## Response Format

The API returns JSON with the following structure:

```json
{
  "results": {
    "copyright": "Copyright (c) 2025 QuoteMedia, Inc.",
    "symbolcount": 100,
    "quote": [
      {
        "key": {
          "symbol": "PAVS",
          "exchange": "NSC",
          "exLgName": "NASDAQ Capital Market",
          "exShName": "NCM",
          "timezone": "EST"
        },
        "equityinfo": {
          "longname": "Paranovus Entertainment Technology Ltd.",
          "shortname": "Paranovus Entert"
        },
        "pricedata": {
          "last": 0.0719,
          "change": -0.9781,
          "changepercent": -93.152382,
          "tick": 0,
          "open": 0.77,
          "high": 0.7802,
          "low": 0.0595,
          "prevclose": 1.05,
          "bid": 0.0717,
          "ask": 0.0719,
          "bidsize": 1100,
          "asksize": 35100,
          "tradevolume": 150015
          // ... more fields
        }
        // ... more data
      }
      // ... more quotes
    ]
  }
}
```

---

## Current Implementation Comparison

### ✅ Already Correct in `/api/tmx-quotemedia-proxy`

1. **Endpoint URL**: ✓ Using correct `getMarketStats.json`
2. **Authentication**: ✓ SID + datatool-token flow working
3. **Parameter names**: ✓ All parameter names match exactly
4. **stat codes**: ✓ Correct mappings (pl, pg, dv, va, dg, dl)
5. **statExchange codes**: ✓ Correct mappings (NSD, NYE, AMX, OTO)
6. **qmodTool mapping**: ✓ Correct category mapping
7. **pathName mapping**: ✓ Correct path mapping

### 🎯 Verification Status

The implementation in `src/app/api/tmx-quotemedia-proxy/route.ts` already has **correct parameter mappings** that match TMX PowerStream exactly. The code shows:

- `statMap` correctly maps stat types
- `statExchangeMap` correctly maps exchanges  
- `categoryToQmodTool` correctly maps categories
- `toolToPathName` correctly maps pathNames

**Conclusion**: The current implementation is **accurate** and matches TMX PowerStream's parameter usage.

---

## Notes

1. **Session ID Format**: TMX uses format `{wmid}-{timestamp}-{counter}` for SID
2. **Webmaster ID**: Always `101020` for TMX PowerStream
3. **Default Values**: TMX defaults to Market Movers, Percent Losers, NASDAQ, Top 100
4. **Parameter Order**: While GET parameters don't strictly require order, TMX sends them in a consistent order
5. **Premarket Flag**: Only included when `marketSession=PRE`
6. **Timezone**: Always set to `true` in TMX

---

**Last Updated**: 2025-12-01  
**Captured From**: TMX PowerStream (https://tmxpowerstream.com/powerStreamWeb.php)  
**Method**: Browser DevTools Network Analysis
