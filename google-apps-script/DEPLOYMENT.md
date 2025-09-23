# Google Apps Script Deployment Instructions

## Step 1: Create the Google Apps Script

1. Go to [Google Apps Script](https://script.google.com/)
2. Click "New Project"
3. Replace the default `Code.gs` content with the code from `yahoo-profile-scraper.js`
4. Save the project with a name like "Yahoo Profile Scraper"

## Step 2: Deploy as Web App

1. Click "Deploy" → "New deployment"
2. Choose type: "Web app"
3. Description: "Yahoo Finance Profile Scraper API"
4. Execute as: "Me"
5. Who has access: "Anyone" (or "Anyone with Google account" for more security)
6. Click "Deploy"
7. **Copy the Web app URL** - you'll need this for your Next.js app

## Step 3: Test the Deployment

Test your deployed web app by visiting:
```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?symbol=AAPL
```

You should get a JSON response like:
```json
{
  "success": true,
  "data": {
    "country": "United States",
    "executives": [
      {
        "name": "Timothy D. Cook",
        "title": "Chief Executive Officer"
      }
    ]
  }
}
```

## Step 4: Update Next.js App

Once deployed, provide me with the web app URL and I'll update the Next.js application to use it.

## Security Notes

- The Apps Script runs with your Google account permissions
- Consider using "Anyone with Google account" instead of "Anyone" for better security
- You can monitor usage in the Apps Script dashboard
- Rate limits apply based on Google Apps Script quotas

## Troubleshooting

- If you get permission errors, make sure the deployment settings are correct
- If scraping fails, check the Apps Script logs in the editor
- Test individual functions using the `testScraper()` function in the editor
