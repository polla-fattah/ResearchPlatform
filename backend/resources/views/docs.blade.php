<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Open Hadith Research Platform — API Documentation</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📜</text></svg>">
    
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Amiri:wght@400;700&display=swap" rel="stylesheet">
    
    <!-- Swagger UI Styles -->
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />

    <style>
        :root {
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --accent-emerald: #10b981;
            --accent-emerald-dark: #059669;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --border-color: #334155;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        /* Top Header Bar */
        .header-bar {
            background-color: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            padding: 0.85rem 1.5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .brand-container {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .brand-logo {
            font-size: 1.8rem;
        }

        .brand-title {
            font-weight: 700;
            font-size: 1.15rem;
            letter-spacing: -0.02em;
            color: #fff;
        }

        .brand-subtitle {
            font-size: 0.78rem;
            color: var(--text-secondary);
        }

        .actions-container {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            flex-wrap: wrap;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.45rem 0.85rem;
            border-radius: 0.375rem;
            font-size: 0.82rem;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s ease;
            border: 1px solid transparent;
        }

        .btn-primary {
            background-color: var(--accent-emerald);
            color: #fff;
        }
        .btn-primary:hover {
            background-color: var(--accent-emerald-dark);
        }

        .btn-outline {
            background-color: rgba(255, 255, 255, 0.05);
            border-color: var(--border-color);
            color: var(--text-secondary);
        }
        .btn-outline:hover {
            color: #fff;
            border-color: var(--text-secondary);
            background-color: rgba(255, 255, 255, 0.1);
        }

        .view-toggle {
            background-color: rgba(0, 0, 0, 0.3);
            border-radius: 0.5rem;
            padding: 0.2rem;
            display: flex;
            border: 1px solid var(--border-color);
        }

        .toggle-tab {
            padding: 0.35rem 0.75rem;
            border-radius: 0.375rem;
            font-size: 0.78rem;
            font-weight: 600;
            cursor: pointer;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            transition: all 0.2s;
        }

        .toggle-tab.active {
            background-color: var(--accent-emerald);
            color: #fff;
        }

        /* View containers */
        #scalar-container {
            flex: 1;
            width: 100%;
        }

        #swagger-container {
            display: none;
            flex: 1;
            padding: 1.5rem;
            background: #ffffff;
            color: #3b4151;
        }

        /* Token Toast Alert */
        .toast {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: #1e293b;
            border: 1px solid var(--accent-emerald);
            color: #fff;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
            font-size: 0.85rem;
            z-index: 1000;
            display: none;
            animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    </style>
</head>
<body>

    <!-- Header Navigation -->
    <header class="header-bar">
        <div class="brand-container">
            <span class="brand-logo">📜</span>
            <div>
                <h1 class="brand-title">Open Hadith Research Platform</h1>
                <p class="brand-subtitle">Empirical & Computational Hadith Studies API — 110 Endpoints</p>
            </div>
        </div>

        <div class="actions-container">
            <!-- 1-Click Auth Buttons for Testing -->
            <button class="btn btn-outline" onclick="loginQuick('polla@sue.edu.krd', 'password123', 'Dr. Polla (PI)')">
                🔑 Auth as Dr. Polla
            </button>
            <button class="btn btn-outline" onclick="loginQuick('editor@openhadith.org', 'password123', 'Executive Editor')">
                🛡️ Auth as Editor
            </button>

            <!-- Download Links -->
            <a href="/docs/openapi.json" target="_blank" class="btn btn-outline" title="OpenAPI 3.1 JSON Specification">
                📄 OpenAPI JSON
            </a>
            <a href="/docs/postman" class="btn btn-outline" title="Download Postman Collection v2.1">
                🚀 Postman
            </a>

            <!-- View Switcher -->
            <div class="view-toggle">
                <button id="btn-scalar" class="toggle-tab active" onclick="switchView('scalar')">Scalar UI</button>
                <button id="btn-swagger" class="toggle-tab" onclick="switchView('swagger')">Swagger UI</button>
            </div>
        </div>
    </header>

    <!-- Token Copied Toast -->
    <div id="toast" class="toast">
        <span id="toast-msg">Token acquired!</span>
    </div>

    <!-- 1. Scalar UI View (Default) -->
    <div id="scalar-container">
        <script
            id="api-reference"
            data-url="/docs/openapi.json"
            data-configuration='{
                "theme": "deepSpace",
                "layout": "modern",
                "showSidebar": true,
                "darkMode": true,
                "searchHotKey": "k",
                "defaultHttpClient": {
                    "targetKey": "php",
                    "clientKey": "curl"
                }
            }'>
        </script>
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    </div>

    <!-- 2. Swagger UI View -->
    <div id="swagger-container">
        <div id="swagger-ui"></div>
    </div>

    <!-- Scripts for Swagger UI and Quick Auth -->
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        let swaggerInitialized = false;

        function switchView(view) {
            const scalarBox = document.getElementById('scalar-container');
            const swaggerBox = document.getElementById('swagger-container');
            const btnScalar = document.getElementById('btn-scalar');
            const btnSwagger = document.getElementById('btn-swagger');

            if (view === 'scalar') {
                scalarBox.style.display = 'block';
                swaggerBox.style.display = 'none';
                btnScalar.classList.add('active');
                btnSwagger.classList.remove('active');
            } else {
                scalarBox.style.display = 'none';
                swaggerBox.style.display = 'block';
                btnScalar.classList.remove('active');
                btnSwagger.classList.add('active');

                if (!swaggerInitialized) {
                    SwaggerUIBundle({
                        url: "/docs/openapi.json",
                        dom_id: '#swagger-ui',
                        deepLinking: true,
                        presets: [
                            SwaggerUIBundle.presets.apis,
                            SwaggerUIBundle.SwaggerUIStandalonePreset
                        ],
                        layout: "BaseLayout"
                    });
                    swaggerInitialized = true;
                }
            }
        }

        async function loginQuick(email, password, label) {
            try {
                showToast(`Authenticating as ${label}...`);
                const res = await fetch('/api/v1/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (data.success && data.data && data.data.token) {
                    const token = data.data.token;
                    navigator.clipboard.writeText(token);
                    showToast(`✓ Authenticated as ${label}! Bearer token copied to clipboard. Ready to paste into Auth header.`);
                } else {
                    showToast(`✗ Failed to authenticate: ${data.message || 'Error'}`);
                }
            } catch (err) {
                showToast(`✗ Error: ${err.message}`);
            }
        }

        function showToast(msg) {
            const t = document.getElementById('toast');
            document.getElementById('toast-msg').innerText = msg;
            t.style.display = 'block';
            setTimeout(() => { t.style.display = 'none'; }, 4000);
        }
    </script>
</body>
</html>
