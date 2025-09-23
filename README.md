# Stock Dashboard (MARIOM)

A professional stock analysis dashboard with real-time data scraping capabilities, built with Next.js and Mantine UI.

## Features

🚀 **Real-time Data**
- NASDAQ halt monitoring with today's halts
- Yahoo Finance executive data scraping
- Premarket low and previous close prices
- ETF/ETN detection

📰 **News Integration** 
- Zacks news aggregation with recent articles
- SEC filings from StockTitan
- Corporate actions tracking

🎨 **Modern UI**
- Responsive design with Mantine UI
- Toast notifications for user feedback
- Loading states and proper error handling
- Mobile-friendly interface

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Library**: Mantine UI v8 with Emotion
- **Data Scraping**: Cheerio, Axios
- **Deployment**: Vercel (serverless functions)
- **Icons**: Tabler Icons

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd mariom
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Endpoints

### `POST /api/symbols`
Add a new stock symbol and fetch comprehensive data:
- Executive information from Yahoo Finance
- Premarket and previous close prices  
- ETF/ETN classification
- Recent news from Zacks
- SEC filings from StockTitan

### `GET /api/halts`
Fetch today's NASDAQ trading halts with:
- Halt date/time information
- Reason codes and market data
- Resumption details

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy automatically with zero configuration

The free tier includes:
- 100GB bandwidth/month
- Serverless function execution
- Custom domains
- Automatic HTTPS

### Manual Deployment

```bash
npm run build
npm run start
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── halts/route.ts    # NASDAQ halts endpoint
│   │   └── symbols/route.ts  # Symbol data endpoint
│   ├── symbol/[ticker]/      # Dynamic symbol pages
│   ├── layout.tsx           # Root layout with Mantine provider
│   └── page.tsx            # Main dashboard
├── components/
│   ├── HaltsTable.tsx      # NASDAQ halts display
│   ├── SymbolInput.tsx     # Symbol input form
│   └── SymbolList.tsx      # Added symbols list
```

## Data Sources

- **Yahoo Finance**: Executive data, stock prices
- **NASDAQ Trader**: Real-time halt information  
- **Zacks**: Recent news articles
- **StockTitan**: SEC filings
- **StockAnalysis**: ETF/ETN classification

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Original Source

Converted from Google Apps Script to Next.js web application, maintaining all core functionality while adding:
- Modern responsive UI
- Better error handling
- Real-time updates
- Mobile optimization
- Vercel deployment support
# mariom
# mariom
