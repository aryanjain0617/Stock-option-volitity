const express = require('express');
const YahooFinance = require('yahoo-finance2').default;
const cors = require('cors');

const app = express();

// Fix: In v3, options are passed directly into the constructor
const yahooFinance = new YahooFinance({
    queue: { concurrency: 1 },
    validation: { logErrors: true }
});

app.use(cors());

app.get('/get-prices', async (req, res) => {
    let symbol = req.query.symbol ? req.query.symbol.trim().toUpperCase() : "";
    if (!symbol) return res.status(400).json({ error: "Symbol required" });

    // Try NSE (.NS) then BSE (.BO)
    const suffixes = symbol.includes('.') ? [symbol] : [`${symbol}.NS`, `${symbol}.BO`];

    for (const querySymbol of suffixes) {
        try {
            console.log(`📡 Fetching data for: ${querySymbol}`);

            // 1. Get Current Quote
            const quote = await yahooFinance.quote(querySymbol);

            // 2. Get History for ATR (using the 'chart' module)
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 40);

            const chartResults = await yahooFinance.chart(querySymbol, {
                period1: start,
                interval: '1d',
            });

            const quotes = chartResults.quotes;

            // 3. ATR Calculation
            if (quotes && quotes.length >= 15) {
                let trValues = [];
                for (let i = 1; i < quotes.length; i++) {
                    const current = quotes[i];
                    const previous = quotes[i - 1];

                    if (current.high && current.low && previous.close) {
                        const tr = Math.max(
                            current.high - current.low,
                            Math.abs(current.high - previous.close),
                            Math.abs(current.low - previous.close)
                        );
                        trValues.push(tr);
                    }
                }

                const last14TR = trValues.slice(-14);
                const avgAtr = last14TR.reduce((a, b) => a + b, 0) / last14TR.length;

                console.log(`✅ Success! Price: ${quote.regularMarketPrice}, ATR: ${avgAtr.toFixed(2)}`);

                return res.json({
                    openingPrice: quote.regularMarketOpen || quote.regularMarketPrice,
                    atr: parseFloat(avgAtr.toFixed(2))
                });
            } else {
                console.log(`⚠️ Not enough history bars for ${querySymbol}`);
            }
        } catch (error) {
            console.log(`❌ Error fetching ${querySymbol}: ${error.message}`);
        }
    }

    res.status(500).json({ error: "Could not fetch ATR/Price." });
});

app.listen(3000, () => console.log('Fixed ATR Server (v3) running on http://localhost:3000'));