const fs = require("fs");
const path = require("path");

const trackingHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Track Your Delivery | Agkey Pro</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        :root {
            --stealth-black: #0A0A0A;
            --racing-red: #E30613;
            --dark-charcoal: #1A1A1A;
            --carbon-line: #2D2D2D;
            --pure-white: #FFFFFF;
            --muted-silver: #A0A0A0;
        }

        * {
            box-sizing: border-box;
        }

        body {
            min-height: 100vh;
            background:
                radial-gradient(circle at 15% -10%, rgba(227, 6, 19, 0.24), transparent 34%),
                radial-gradient(circle at 90% 8%, rgba(227, 6, 19, 0.10), transparent 28%),
                linear-gradient(135deg, #0A0A0A 0%, #111111 44%, #050505 100%);
            color: var(--pure-white);
            letter-spacing: -0.01em;
        }

        .text-racing-red { color: var(--racing-red); }
        .bg-racing-red { background-color: var(--racing-red); }
        .border-racing-red { border-color: var(--racing-red); }
        .text-silver { color: var(--muted-silver); }
        .bg-stealth { background-color: var(--stealth-black); }
        .bg-surface { background-color: var(--dark-charcoal); }
        .border-carbon { border-color: var(--carbon-line); }

        .carbon-card {
            position: relative;
            overflow: hidden;
            border: 1px solid var(--carbon-line);
            border-radius: 6px;
            background:
                linear-gradient(135deg, rgba(255, 255, 255, 0.045), transparent 30%),
                repeating-linear-gradient(
                    135deg,
                    rgba(255, 255, 255, 0.035) 0,
                    rgba(255, 255, 255, 0.035) 1px,
                    transparent 1px,
                    transparent 9px
                ),
                var(--dark-charcoal);
            box-shadow: 0 18px 44px rgba(0, 0, 0, 0.42);
        }

        .carbon-card::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .agkey-slash {
            transform: skewX(-13deg);
            border-radius: 4px;
            box-shadow: 0 0 24px rgba(227, 6, 19, 0.46);
        }

        .red-glow {
            box-shadow:
                0 0 0 1px rgba(227, 6, 19, 0.50),
                0 0 22px rgba(227, 6, 19, 0.42) !important;
        }

        .button-red {
            background: linear-gradient(135deg, #E30613 0%, #A9000A 100%);
            color: var(--pure-white);
            border: 1px solid rgba(255, 255, 255, 0.10);
            border-radius: 6px;
            box-shadow: 0 14px 34px rgba(227, 6, 19, 0.24);
        }

        .fade-in {
            animation: fadeIn 520ms ease-out both;
        }
        .fade-delay-1 { animation-delay: 90ms; }
        .fade-delay-2 { animation-delay: 160ms; }
        .fade-delay-3 { animation-delay: 230ms; }

        .timeline-line {
            position: absolute;
            left: 5px;
            top: 6px;
            bottom: 6px;
            width: 2px;
            background: linear-gradient(180deg, var(--racing-red), rgba(227, 6, 19, 0.16));
            box-shadow: 0 0 18px rgba(227, 6, 19, 0.36);
        }

        .performance-certificate {
            border-color: rgba(227, 6, 19, 0.78);
            box-shadow:
                inset 0 0 0 1px rgba(227, 6, 19, 0.28),
                0 0 24px rgba(227, 6, 19, 0.16);
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(8px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    </style>
</head>
<body class="font-sans antialiased">
    <div class="mx-auto max-w-md px-5 py-8">
        <!-- Header -->
        <div class="mb-6 fade-in">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-xs font-black uppercase tracking-[0.18em] text-racing-red">Agkey Pro Logistics</p>
                    <h1 class="mt-1 text-4xl font-black tracking-tight text-white">Delivery Intel</h1>
                    <p class="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-silver">Stealth tracking system</p>
                </div>
                <div class="agkey-slash flex h-12 w-12 items-center justify-center bg-racing-red text-xl font-black text-white">
                    A
                </div>
            </div>
        </div>

        <!-- Weather-Aware Greeting -->
        <div id="personalGreeting" class="carbon-card mb-4 p-4 text-sm font-bold leading-relaxed text-white fade-in fade-delay-1">
            Your Agkey command station is on its way.
        </div>

        <!-- Order Info -->
        <div id="orderInfo" class="carbon-card hidden mb-8 p-5 fade-in fade-delay-1">
            <p class="text-xs font-black uppercase tracking-[0.14em] text-silver">Tracking ID</p>
            <h2 id="orderId" class="mt-1 font-mono text-2xl font-black tracking-tight text-white"></h2>
            <p class="mt-5 text-xs font-black uppercase tracking-[0.14em] text-silver">Customer</p>
            <p class="mt-1 text-xl font-black tracking-tight text-white" id="customerName"></p>
            <div id="itemList" class="mt-5 space-y-2 text-sm font-semibold text-silver"></div>
        </div>

        <!-- Timeline -->
        <div class="relative pl-8 space-y-8 fade-in fade-delay-2" id="timeline">
            <!-- Timeline items injected via JS -->
        </div>

        <!-- Preparation Guide -->
        <section id="prepGuide" class="carbon-card mt-10 p-5 fade-in fade-delay-3">
            <p class="text-xs font-black uppercase tracking-[0.18em] text-racing-red">While You Wait</p>
            <h3 id="prepTitle" class="mt-2 text-2xl font-black tracking-tight text-white">Pre-flight checks</h3>
            <p id="prepDescription" class="mt-2 text-sm font-semibold leading-relaxed text-silver">
                Dial in the setup zone before your Agkey order lands.
            </p>

            <div id="prepChecklist" class="mt-5 space-y-3"></div>

            <div id="prepBadge" class="mt-5 rounded-md border border-carbon bg-[#111111] p-4">
                <p id="prepBadgeTitle" class="text-xs font-black uppercase tracking-[0.16em] text-racing-red">Agkey Quality Assurance</p>
                <p id="prepBadgeCopy" class="mt-1 text-sm font-bold leading-relaxed text-white">
                    Every Agkey order is packed with care and checked before dispatch.
                </p>
            </div>
        </section>

        <!-- POD Image -->
        <div id="podSection" class="hidden mt-10 fade-in">
            <h3 class="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white">Proof of Delivery</h3>
            <div class="carbon-card p-1">
                <img id="podImage" src="" alt="Proof of Delivery" class="h-auto w-full rounded object-cover">
            </div>
        </div>

        <!-- Loading / Error -->
        <div id="message" class="carbon-card mt-10 p-5 text-center text-sm font-bold text-silver">
            Loading tracking information...
        </div>
    </div>

    <script>
        const statuses = ["Order Confirmed", "Processing", "Out for Delivery", "Arriving Soon", "Delivered"];
        const PRODUCTION_API_BASE = "https://agkey-pro-tms.onrender.com/api";
        const isLocalFrontend =
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1" ||
            window.location.protocol === "file:";
        const API_BASE = isLocalFrontend ? "http://localhost:3000/api" : PRODUCTION_API_BASE;
        const urlParams = new URLSearchParams(window.location.search);
        const trackingId = urlParams.get("id") || "AGK-T-XXXXXX";

        function resolveAssetUrl(assetUrl) {
            if (!assetUrl) {
                return "";
            }

            if (/^https?:\\/\\//i.test(assetUrl)) {
                return assetUrl;
            }

            return API_BASE.replace(/\\/api\\/?$/, "") + assetUrl;
        }

        function setPersonalGreeting() {
            const hour = new Date().getHours();
            let greeting = "Good evening";

            if (hour < 12) {
                greeting = "Good morning";
            } else if (hour < 18) {
                greeting = "Good afternoon";
            }

            document.getElementById("personalGreeting").innerText =
                greeting + "! Your Agkey command station is on its way.";
        }

        function getLineItems(order) {
            return Array.isArray(order && order.lineItems) ? order.lineItems : [];
        }

        function getLineItemName(item) {
            return String(
                (item && (item.itemName || item.title || item.name || item.sku)) || ""
            ).trim();
        }

        function getOrderItemText(order) {
            return getLineItems(order)
                .map(getLineItemName)
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
        }

        function buildPreparationConfig(order) {
            const itemText = getOrderItemText(order);
            const hasDesk = itemText.includes("desk") || itemText.includes("table");
            const hasChair =
                itemText.includes("chair") ||
                itemText.includes("seat") ||
                itemText.includes("stool");

            if (hasDesk) {
                return {
                    title: "Desk arrival prep",
                    description: "Clear the landing zone before your performance surface arrives.",
                    checklist: [
                        "2x2m Space Required",
                        "Power Socket Nearby",
                        "ENF Grade Certified Board (≤ 0.025 mg/m³)"
                    ],
                    badgeTitle: "Performance Certificate",
                    badgeCopy: "Desk wood panels only: ENF Grade Certified Board (Formaldehyde ≤ 0.025 mg/m³).",
                    performance: true
                };
            }

            if (hasChair) {
                return {
                    title: "Chair cockpit prep",
                    description: "Prep the adjustment zone so your chair is ready for long-session comfort.",
                    checklist: [
                        "Soft Assembly Area (Rug/Carpet)",
                        "Check All Adjustment Levers",
                        "3-Year Warranty Support"
                    ],
                    badgeTitle: "Agkey Quality Assurance",
                    badgeCopy: "Your chair order is prepared for comfort, adjustability, and dependable everyday support.",
                    performance: false
                };
            }

            return {
                title: "Peripheral loadout prep",
                description: "Small upgrades, cleaner command center, sharper desk energy.",
                checklist: [
                    "Unbox & Upgrade",
                    "Desktop Aesthetic Tip: Hide your cables for a 'Geek's Tenderness' look",
                    "Tag us @Agkey on social!"
                ],
                badgeTitle: "Agkey Quality Assurance",
                badgeCopy: "Every Agkey order is packed with care and checked before dispatch.",
                performance: false
            };
        }

        function renderPreparationGuide(order) {
            const config = buildPreparationConfig(order);
            const badge = document.getElementById("prepBadge");

            document.getElementById("prepTitle").innerText = config.title;
            document.getElementById("prepDescription").innerText = config.description;
            document.getElementById("prepBadgeTitle").innerText = config.badgeTitle;
            document.getElementById("prepBadgeCopy").innerText = config.badgeCopy;
            badge.className = config.performance
                ? "performance-certificate mt-5 rounded-md border bg-[#111111] p-4"
                : "mt-5 rounded-md border border-carbon bg-[#111111] p-4";

            document.getElementById("prepChecklist").innerHTML = config.checklist
                .map((item) => \`
                    <div class="flex items-center gap-3 rounded-md border border-carbon bg-[#111111] p-3 transition duration-300 ease-out hover:-translate-y-0.5 hover:border-racing-red">
                        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-racing-red bg-[#190406] text-sm font-black text-racing-red red-glow">✓</span>
                        <span class="text-sm font-bold leading-snug text-white">\${item}</span>
                    </div>
                \`)
                .join("");
        }

        async function fetchOrder() {
            try {
                const response = await fetch(API_BASE + "/orders/" + encodeURIComponent(trackingId));
                if (!response.ok) throw new Error("Order not found");
                const data = await response.json();
                renderUI(data.order || data);
            } catch (error) {
                document.getElementById("message").innerText = "Unable to find live tracking information. Showing demo progress.";
                renderUI({
                    trackingId: trackingId,
                    customerName: "J*** Doe",
                    status: "Out for Delivery",
                    lineItems: [{ itemName: "Black Electric Standing Desk", quantity: 1 }]
                });
            }
        }

        function renderUI(order = {}) {
            document.getElementById("message").classList.add("hidden");
            document.getElementById("orderInfo").classList.remove("hidden");
            document.getElementById("orderId").innerText = order.trackingId || trackingId;
            document.getElementById("customerName").innerText = order.customerName || "Customer";

            const itemHtml = getLineItems(order)
                .map((item) => {
                    const itemName = getLineItemName(item) || "Agkey item";
                    const quantity = Number((item && item.quantity) || 1);

                    return \`<div class="flex justify-between gap-4 border-b border-carbon pb-2 last:border-b-0"><span>\${itemName}</span><span class="font-black text-white">x\${quantity}</span></div>\`;
                })
                .join("") || '<div class="text-sm font-semibold text-silver">Order details are being prepared.</div>';
            document.getElementById("itemList").innerHTML = itemHtml;
            renderPreparationGuide(order);

            const currentStatusIndex = statuses.indexOf(order.status) !== -1 ? statuses.indexOf(order.status) : 0;
            const timelineHtml = \`
                <div class="timeline-line"></div>
                \${statuses.map((status, index) => {
                    const isActive = index <= currentStatusIndex;
                    const isCurrent = index === currentStatusIndex;
                    const nodeClass = isActive
                        ? "bg-racing-red border-racing-red " + (isCurrent ? "red-glow" : "")
                        : "bg-[#111111] border-carbon";
                    const titleClass = isCurrent ? "text-white font-black" : (isActive ? "text-white font-bold" : "text-silver font-bold");
                    const label = isCurrent ? "Current status" : (isActive ? "Completed" : "Pending");

                    return \`
                        <div class="relative min-h-12">
                            <div class="absolute -left-[31px] top-1 h-5 w-5 rounded-sm border-4 \${nodeClass} ring-4 ring-[#0A0A0A]"></div>
                            <div class="\${titleClass} text-base tracking-tight">\${status}</div>
                            <div class="mt-1 text-xs font-black uppercase tracking-[0.10em] \${isActive ? "text-racing-red" : "text-silver"}">\${label}</div>
                        </div>
                    \`;
                }).join("")}
            \`;

            document.getElementById("timeline").innerHTML = timelineHtml;

            if (order.status === "Delivered" && order.podImageUrl) {
                document.getElementById("podSection").classList.remove("hidden");
                document.getElementById("podImage").src = resolveAssetUrl(order.podImageUrl);
            }
        }

        setPersonalGreeting();
        fetchOrder();
    </script>
</body>
</html>`;

const driverHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Driver Portal | Agkey Pro</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        :root {
            --stealth-black: #0A0A0A;
            --racing-red: #E30613;
            --dark-charcoal: #1A1A1A;
            --carbon-line: #2D2D2D;
            --pure-white: #FFFFFF;
            --muted-silver: #A0A0A0;
        }

        body {
            background:
                radial-gradient(circle at 25% -10%, rgba(227, 6, 19, 0.22), transparent 30%),
                linear-gradient(135deg, #0A0A0A 0%, #111111 48%, #050505 100%);
            color: var(--pure-white);
            letter-spacing: -0.01em;
        }

        .bg-racing-red { background-color: var(--racing-red); }
        .text-racing-red { color: var(--racing-red); }
        .text-silver { color: var(--muted-silver); }
        .border-carbon { border-color: var(--carbon-line); }

        .dashboard-panel {
            border: 1px solid var(--carbon-line);
            border-radius: 6px;
            background:
                linear-gradient(135deg, rgba(255, 255, 255, 0.045), transparent 34%),
                repeating-linear-gradient(
                    135deg,
                    rgba(255, 255, 255, 0.034) 0,
                    rgba(255, 255, 255, 0.034) 1px,
                    transparent 1px,
                    transparent 9px
                ),
                var(--dark-charcoal);
            box-shadow: 0 18px 44px rgba(0, 0, 0, 0.44);
        }

        .button-red {
            background: linear-gradient(135deg, #E30613 0%, #A9000A 100%);
            color: var(--pure-white);
            border: 1px solid rgba(255, 255, 255, 0.10);
            border-radius: 6px;
            box-shadow: 0 14px 34px rgba(227, 6, 19, 0.24);
        }

        .delivered-glow {
            box-shadow:
                0 0 0 1px rgba(227, 6, 19, 0.60),
                0 0 26px rgba(227, 6, 19, 0.54),
                0 18px 42px rgba(227, 6, 19, 0.28) !important;
        }

        .agkey-slash {
            transform: skewX(-13deg);
            border-radius: 4px;
            box-shadow: 0 0 24px rgba(227, 6, 19, 0.46);
        }

        .fade-in {
            animation: fadeIn 420ms ease-out both;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(8px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    </style>
</head>
<body class="flex h-screen flex-col font-sans antialiased">
    <!-- Header -->
    <header class="border-b border-carbon bg-[#0D0D0D] px-5 py-4 shadow-lg shadow-black/40">
        <div class="flex items-center justify-between">
            <div>
                <p class="text-xs font-black uppercase tracking-[0.18em] text-racing-red">Agkey Pro Dispatch</p>
                <h1 class="mt-1 text-2xl font-black tracking-tight text-white">Driver Dashboard</h1>
            </div>
            <span id="currentStatusHeader" class="rounded-sm border border-racing-red bg-[#190406] px-3 py-1.5 text-sm font-black uppercase tracking-tight text-racing-red">
                Ready
            </span>
        </div>
    </header>

    <main class="flex-1 overflow-y-auto p-4">
        <!-- View A: Search -->
        <div id="viewSearch" class="flex h-full flex-col items-center justify-center space-y-6 fade-in">
            <div class="dashboard-panel w-full max-w-sm p-5">
                <label class="mb-3 block text-sm font-black uppercase tracking-[0.14em] text-silver">Scan or Enter Tracking ID</label>
                <input type="text" id="searchInput" placeholder="AGK-T-XXXXXX" class="w-full rounded-md border-2 border-carbon bg-[#0F0F0F] px-4 py-5 text-center font-mono text-3xl font-black uppercase tracking-tight text-white outline-none focus:border-racing-red focus:ring-4 focus:ring-red-950">
            </div>
            <button onclick="searchOrder()" class="button-red w-full max-w-sm px-5 py-6 text-2xl font-black uppercase tracking-tight transition active:scale-95">
                Find Order
            </button>
        </div>

        <!-- View B: Action Screen -->
        <div id="viewAction" class="hidden flex-col space-y-4 pb-20 fade-in">
            <button onclick="resetView()" class="mb-2 flex min-h-12 items-center text-base font-black uppercase tracking-tight text-racing-red">← Back to Search</button>

            <div class="dashboard-panel p-5">
                <p class="text-xs font-black uppercase tracking-[0.14em] text-silver">Active Delivery</p>
                <h2 id="d_trackingId" class="mt-1 font-mono text-3xl font-black tracking-tight text-white">AGK-T-...</h2>

                <div class="mt-5 space-y-4">
                    <div>
                        <p class="text-xs font-black uppercase tracking-[0.14em] text-silver">Customer</p>
                        <p class="mt-1 text-2xl font-black tracking-tight text-white" id="d_name">Customer Name</p>
                    </div>

                    <a id="d_phone" href="tel:" class="button-red flex min-h-16 w-full items-center justify-center px-4 text-xl font-black tracking-tight">
                        Call Customer
                    </a>

                    <div class="rounded-md border border-carbon bg-[#111111] p-4">
                        <p class="mb-1 text-xs font-black uppercase tracking-[0.14em] text-silver">Address</p>
                        <p id="d_address" class="text-lg font-bold leading-snug text-white">123 Street...</p>
                    </div>

                    <div class="rounded-md border border-red-950 bg-[#190406] p-4">
                        <p class="mb-1 text-xs font-black uppercase tracking-[0.14em] text-racing-red">Delivery Notes</p>
                        <p id="d_notes" class="text-base font-semibold leading-snug text-white">No notes.</p>
                    </div>
                </div>
            </div>

            <div class="mt-6 space-y-3">
                <button onclick="updateStatus('Processing')" class="button-red w-full px-5 py-5 text-xl font-black uppercase tracking-tight transition active:scale-95">
                    Set: Processing
                </button>
                <button onclick="updateStatus('Out for Delivery')" class="button-red w-full px-5 py-5 text-xl font-black uppercase tracking-tight transition active:scale-95">
                    Set: Out for Delivery
                </button>
                <button onclick="updateStatus('Arriving Soon')" class="button-red w-full px-5 py-5 text-xl font-black uppercase tracking-tight transition active:scale-95">
                    Set: Arriving Soon
                </button>

                <!-- POD Upload -->
                <div class="relative mt-8">
                    <input type="file" accept="image/*" capture="environment" id="podInput" class="hidden" onchange="handleDeliveryUpload(event)">
                    <button onclick="document.getElementById('podInput').click()" class="delivered-glow flex min-h-24 w-full items-center justify-center rounded-md bg-[#E30613] px-5 text-2xl font-black uppercase tracking-tight text-white transition active:scale-95">
                        Delivered & Photo
                    </button>
                </div>
            </div>
        </div>
    </main>

    <script>
        let currentTrackingId = "";
        const PRODUCTION_API_BASE = "https://agkey-pro-tms.onrender.com/api";
        const isLocalFrontend =
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1" ||
            window.location.protocol === "file:";
        const API_BASE = isLocalFrontend ? "http://localhost:3000/api" : PRODUCTION_API_BASE;

        function resetView() {
            document.getElementById("viewAction").classList.add("hidden");
            document.getElementById("viewSearch").classList.remove("hidden");
            document.getElementById("searchInput").value = "";
            document.getElementById("currentStatusHeader").innerText = "Ready";
        }

        function formatDeliveryAddress(address = {}) {
            const suburbLine = [address.suburb, address.state, address.postcode]
                .filter(Boolean)
                .join(" ");

            return [address.street, suburbLine].filter(Boolean).join(", ") || "Address unavailable";
        }

        function populateDriverOrder(order = {}) {
            const phoneNumber = order.phoneNumber || "";

            document.getElementById("d_trackingId").innerText = order.trackingId || currentTrackingId;
            document.getElementById("d_name").innerText = order.customerName || "Customer";
            document.getElementById("d_phone").href = phoneNumber ? "tel:" + phoneNumber.split(" ").join("") : "tel:";
            document.getElementById("d_phone").innerText = phoneNumber || "Call Customer";
            document.getElementById("d_address").innerText = formatDeliveryAddress(order.deliveryAddress);
            document.getElementById("d_notes").innerText = order.deliveryInstructions || "No notes.";
            document.getElementById("currentStatusHeader").innerText = order.status || "Processing";
        }

        async function searchOrder() {
            const input = document.getElementById("searchInput").value.trim().toUpperCase();
            if (!input) return alert("Please enter a tracking ID");

            currentTrackingId = input;

            let order = {
                trackingId: currentTrackingId,
                customerName: "John Doe (Demo Fallback)",
                phoneNumber: "+61 400 000 000",
                deliveryAddress: {
                    street: "123 Collins St",
                    suburb: "Melbourne",
                    state: "VIC",
                    postcode: "3000"
                },
                deliveryInstructions: "Please leave at the reception.",
                status: "Processing"
            };

            try {
                const response = await fetch(API_BASE + "/orders/" + encodeURIComponent(currentTrackingId));

                if (response.ok) {
                    const data = await response.json();
                    order = data.order || data;
                }
            } catch (error) {
                console.warn("Using fallback driver order data because the backend fetch failed.");
            }

            document.getElementById("viewSearch").classList.add("hidden");
            document.getElementById("viewAction").classList.remove("hidden");
            document.getElementById("viewAction").classList.add("flex");

            populateDriverOrder(order);
        }

        async function updateStatus(status) {
            if (!confirm(\`Update status to '\${status}'?\`)) return;

            try {
                const response = await fetch(\`\${API_BASE}/orders/\${currentTrackingId}/status\`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status })
                });

                if (response.ok) {
                    alert(\`Status updated to \${status}\`);
                    document.getElementById("currentStatusHeader").innerText = status;
                    return;
                }

                alert("Failed to update status on server.");
            } catch (error) {
                alert("Network error. Is the backend running?");
            }
        }

        async function handleDeliveryUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append("status", "Delivered");
            formData.append("podImage", file);

            document.getElementById("currentStatusHeader").innerText = "Uploading...";

            try {
                const response = await fetch(\`\${API_BASE}/orders/\${currentTrackingId}/status\`, {
                    method: "PATCH",
                    body: formData
                });

                if (response.ok) {
                    alert("Delivery completed successfully.");
                    resetView();
                    return;
                }

                const errorMessage = await response.json();
                alert("Upload failed: " + (errorMessage.message || "Unknown error"));
                document.getElementById("currentStatusHeader").innerText = "Error";
            } catch (error) {
                alert("Network error during upload.");
                document.getElementById("currentStatusHeader").innerText = "Error";
            }
        }
    </script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, "tracking.html"), trackingHtmlContent);
fs.writeFileSync(path.join(__dirname, "driver.html"), driverHtmlContent);

console.log("Agkey Pro front-end files (tracking.html & driver.html) have been generated successfully in the root directory.");
