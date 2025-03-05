const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
const PORT = process.env.PORT || 8080;


// Serve static files from the public directory with proper caching
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

// Proxy /api requests to the Java backend
app.use('/api', createProxyMiddleware({
    target: backendUrl,

    changeOrigin: true,
    pathRewrite: {
        '^/api': '/api'
    }
}));

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Handle all other routes by serving index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Add 404 handling for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
