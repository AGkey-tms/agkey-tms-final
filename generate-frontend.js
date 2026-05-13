const fs = require('fs');
const path = require('path');

const trackingHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Track Your Delivery | Agkey</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* 深胡桃木色主题 */
        .theme-walnut { color: #3A2A21; }
        .bg-walnut { background-color: #3A2A21; }
        .border-walnut { border-color: #3A2A21; }
    </style>
</head>
<body class="bg-white text-gray-800 font-sans antialiased">
    <div class="max-w-md mx-auto p-6 mt-10">
        <!-- Header -->
        <div class="text-center mb-10">
            <h1 class="text-3xl font-bold theme-walnut tracking-tight">Agkey</h1>
            <p class="text-sm text-gray-400 mt-2 uppercase tracking-widest">Local Delivery Tracking</p>
        </div>

        <!-- Order Info -->
        <div id="orderInfo" class="hidden mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm">
            <h2 class="text-sm text-gray-500 mb-1">Order #<span id="orderId" class="font-mono text-gray-900"></span></h2>
            <p class="text-lg font-medium text-gray-900" id="customerName"></p>
            <div id="itemList" class="mt-4 text-sm text-gray-600 space-y-1"></div>
        </div>

        <!-- Timeline -->
        <div class="relative pl-4 border-l-2 border-gray-100 space-y-8" id="timeline">
            <!-- Timeline items injected via JS -->
        </div>

        <!-- POD Image -->
        <div id="podSection" class="hidden mt-10">
            <h3 class="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Proof of Delivery</h3>
            <div class="rounded-2xl overflow-hidden shadow-lg border border-gray-100">
                <img id="podImage" src="" alt="Proof of Delivery" class="w-full h-auto object-cover">
            </div>
        </div>

        <!-- Loading / Error -->
        <div id="message" class="text-center text-gray-500 mt-10">Loading tracking information...</div>
    </div>

    <script>
        const statuses = ["Order Confirmed", "Processing", "Out for Delivery", "Arriving Soon", "Delivered"];
        const urlParams = new URLSearchParams(window.location.search);
        // 为了本地测试方便，如果没有带参数，默认使用我们刚才测试生成的单号
        const trackingId = urlParams.get('id') || 'AGK-T-XXXXXX'; // 请替换为刚才生成的单号进行测试

        async function fetchOrder() {
            try {
                // 注意：由于跨域限制，如果你直接双击打开HTML，建议先mock数据或配置CORS。
                // 这里的 URL 需要指向你的后端服务 (目前是 localhost:3000)
                const response = await fetch(\`http://localhost:3000/api/orders/\${trackingId}\`);
                if (!response.ok) throw new Error('Order not found');
                const data = await response.json();
                renderUI(data.order || data);
            } catch (error) {
                document.getElementById('message').innerText = 'Unable to find tracking information. Please check your link.';
                // 降级演示：如果后端没连上，展示一个 Mock 数据看 UI 效果
                renderUI({
                    trackingId: trackingId,
                    customerName: "J*** Doe",
                    status: "Out for Delivery",
                    lineItems: [{ itemName: "Black Single-Motor Electric Standing Desk", quantity: 1 }]
                });
            }
        }

        function renderUI(order) {
            document.getElementById('message').classList.add('hidden');
            document.getElementById('orderInfo').classList.remove('hidden');
            
            document.getElementById('orderId').innerText = order.trackingId;
            document.getElementById('customerName').innerText = order.customerName || "Customer";
            
            const itemHtml = (order.lineItems || []).map(i => \`<div>\${i.quantity}x \${i.itemName}</div>\`).join('');
            document.getElementById('itemList').innerHTML = itemHtml;

            const currentStatusIndex = statuses.indexOf(order.status) !== -1 ? statuses.indexOf(order.status) : 0;
            
            const timelineHtml = statuses.map((status, index) => {
                const isActive = index <= currentStatusIndex;
                const isCurrent = index === currentStatusIndex;
                const colorClass = isActive ? 'bg-walnut' : 'bg-gray-200';
                const textClass = isCurrent ? 'text-gray-900 font-semibold' : (isActive ? 'text-gray-600' : 'text-gray-400');
                
                return \`
                    <div class="relative flex items-center">
                        <div class="absolute -left-[21px] w-3 h-3 rounded-full \${colorClass} ring-4 ring-white"></div>
                        <div class="pl-4 \${textClass} text-sm tracking-wide">\${status}</div>
                    </div>
                \`;
            }).join('');
            
            document.getElementById('timeline').innerHTML = timelineHtml;

            if (order.status === "Delivered" && order.podImageUrl) {
                document.getElementById('podSection').classList.remove('hidden');
                document.getElementById('podImage').src = \`http://localhost:3000\${order.podImageUrl}\`;
            }
        }

        fetchOrder();
    </script>
</body>
</html>`;

const driverHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Driver Portal | Agkey</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 text-gray-900 font-sans h-screen flex flex-col">
    <!-- Header -->
    <header class="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center">
        <h1 class="text-xl font-bold">Driver Portal</h1>
        <span id="currentStatusHeader" class="text-sm font-medium bg-slate-700 px-2 py-1 rounded">Ready</span>
    </header>

    <main class="flex-1 overflow-y-auto p-4">
        <!-- View A: Search -->
        <div id="viewSearch" class="flex flex-col items-center justify-center h-full space-y-6">
            <div class="w-full max-w-sm">
                <label class="block text-gray-700 text-sm font-bold mb-2">Scan or Enter Tracking ID</label>
                <input type="text" id="searchInput" placeholder="AGK-T-XXXXXX" class="shadow appearance-none border rounded w-full py-4 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-4 focus:ring-blue-300 text-2xl uppercase text-center font-mono">
            </div>
            <button onclick="searchOrder()" class="w-full max-w-sm bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-xl shadow-lg active:scale-95 transition-transform">
                Find Order
            </button>
        </div>

        <!-- View B: Action Screen -->
        <div id="viewAction" class="hidden flex-col space-y-4 pb-20">
            <button onclick="resetView()" class="text-blue-600 font-medium text-sm flex items-center mb-2">← Back to Search</button>
            
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                <div class="flex justify-between items-start mb-4">
                    <h2 id="d_trackingId" class="text-xl font-mono font-bold text-gray-800">AGK-T-...</h2>
                </div>
                <div class="space-y-3">
                    <p class="text-lg font-semibold" id="d_name">Customer Name</p>
                    <a id="d_phone" href="tel:" class="inline-flex items-center justify-center bg-green-100 text-green-800 px-4 py-2 rounded-lg font-bold text-lg w-full mb-2">
                        📞 Call Customer
                    </a>
                    <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p class="text-sm text-gray-500 uppercase font-bold text-xs mb-1">Address</p>
                        <p id="d_address" class="text-base font-medium">123 Street...</p>
                    </div>
                    <div class="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                        <p class="text-sm text-yellow-800 font-bold mb-1">Delivery Notes:</p>
                        <p id="d_notes" class="text-sm text-yellow-700 italic">No notes.</p>
                    </div>
                </div>
            </div>

            <div class="space-y-3 mt-6">
                <button onclick="updateStatus('Out for Delivery')" class="w-full bg-slate-800 text-white font-bold py-4 rounded-xl text-lg shadow active:scale-95 transition">
                    🚚 Set: Out for Delivery
                </button>
                <button onclick="updateStatus('Arriving Soon')" class="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-lg shadow active:scale-95 transition">
                    📍 Set: Arriving Soon
                </button>
                
                <!-- POD Upload -->
                <div class="mt-8 relative">
                    <input type="file" accept="image/*" capture="environment" id="podInput" class="hidden" onchange="handleDeliveryUpload(event)">
                    <button onclick="document.getElementById('podInput').click()" class="w-full bg-green-600 text-white font-bold py-6 rounded-xl text-2xl shadow-xl active:scale-95 transition flex items-center justify-center">
                        📸 Delivered & Photo
                    </button>
                </div>
            </div>
        </div>
    </main>

    <script>
        let currentTrackingId = '';
        const API_BASE = 'http://localhost:3000/api';

        function resetView() {
            document.getElementById('viewAction').classList.add('hidden');
            document.getElementById('viewSearch').classList.remove('hidden');
            document.getElementById('searchInput').value = '';
            document.getElementById('currentStatusHeader').innerText = 'Ready';
        }

        async function searchOrder() {
            const input = document.getElementById('searchInput').value.trim().toUpperCase();
            if (!input) return alert('Please enter a tracking ID');
            
            // Mocking the GET request for UI testing since we haven't written the GET endpoint yet
            currentTrackingId = input;
            
            document.getElementById('viewSearch').classList.add('hidden');
            document.getElementById('viewAction').classList.remove('hidden');
            document.getElementById('viewAction').classList.add('flex');
            
            document.getElementById('d_trackingId').innerText = currentTrackingId;
            document.getElementById('d_name').innerText = "John Doe (Mock Data)";
            document.getElementById('d_phone').href = "tel:+61400000000";
            document.getElementById('d_phone').innerHTML = "📞 +61 400 000 000";
            document.getElementById('d_address').innerText = "123 Collins St, Melbourne VIC 3000";
            document.getElementById('d_notes').innerText = "Please leave at the reception.";
            document.getElementById('currentStatusHeader').innerText = 'Processing';
        }

        async function updateStatus(status) {
            if(!confirm(\`Update status to '\${status}'?\`)) return;
            try {
                const res = await fetch(\`\${API_BASE}/orders/\${currentTrackingId}/status\`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status })
                });
                if(res.ok) {
                    alert(\`Status updated to \${status}\`);
                    document.getElementById('currentStatusHeader').innerText = status;
                } else {
                    alert('Failed to update status on server.');
                }
            } catch(e) {
                alert('Network error. Is the backend running?');
            }
        }

        async function handleDeliveryUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('status', 'Delivered');
            formData.append('podImage', file); // Matches multer config

            document.getElementById('currentStatusHeader').innerText = 'Uploading...';

            try {
                const res = await fetch(\`\${API_BASE}/orders/\${currentTrackingId}/status\`, {
                    method: 'PATCH',
                    body: formData
                });
                
                if (res.ok) {
                    alert('🎉 Delivery completed successfully!');
                    resetView();
                } else {
                    const errorMsg = await res.json();
                    alert('Upload failed: ' + (errorMsg.message || 'Unknown error'));
                    document.getElementById('currentStatusHeader').innerText = 'Error';
                }
            } catch (error) {
                alert('Network error during upload.');
                document.getElementById('currentStatusHeader').innerText = 'Error';
            }
        }
    </script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'tracking.html'), trackingHtmlContent);
fs.writeFileSync(path.join(__dirname, 'driver.html'), driverHtmlContent);

console.log('✅ Front-end files (tracking.html & driver.html) have been generated successfully in the root directory!');
