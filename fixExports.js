const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'afrontend/src/modules/admin/pages');
const files = [
  'AdminAllOrders.tsx',
  'AdminCancelledOrders.tsx',
  'AdminDeliveredOrders.tsx',
  'AdminOutForDeliveryOrders.tsx',
  'AdminPendingOrders.tsx',
  'AdminProcessedOrders.tsx',
  'AdminReceivedOrders.tsx',
  'AdminShippedOrders.tsx'
];

files.forEach(file => {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`File ${file} not found.`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Regex to find handleExport entirely
  const regex = /const handleExport = \(\) => \{[\s\S]*?document\.body\.removeChild\(link\);\s*\};/g;
  
  let prefix = file.replace('Admin', '').replace('Orders.tsx', '').toLowerCase() || 'all';
  if (prefix === 'all') prefix = 'all';

  const replacement = `const handleExport = () => {
    const headers = [
      "O. Id",
      "Customer Details",
      "Address",
      "D. Date",
      "O. Date",
      "Status",
      "Delivery Boy Assign Status",
      "Seller Name",
      "Seller Amount",
      "Total Amount",
    ];
    const csvContent = [
      headers.join(","),
      ...filteredAndSortedOrders.map((order) => {
        let sellerNames = "Unknown";
        let sellerAmount = 0;

        if (order.items && Array.isArray(order.items)) {
          const names = new Set<string>();
          order.items.forEach((item: any) => {
            if (item.seller && typeof item.seller === "object") {
              names.add(item.seller.storeName || item.seller.sellerName || "Unknown");
            } else if (typeof item.seller === "string") {
              names.add(item.seller);
            }
            sellerAmount += item.total || item.unitPrice * item.quantity || 0;
          });
          if (names.size > 0) {
            sellerNames = Array.from(names).join(" | ");
          }
        } else {
          sellerAmount = order.total || 0;
        }

        const cName = order.customerName || (typeof order.customer === "object" ? order.customer.name : "") || "";
        const addr = order.deliveryAddress?.address || "";
        
        return [
          order.orderNumber || "",
          \`"\${cName.replace(/"/g, '""')}"\`,
          \`"\${addr.replace(/"/g, '""')}"\`,
          order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).toLocaleDateString() : "",
          order.orderDate ? new Date(order.orderDate).toLocaleDateString() : "",
          order.status || "",
          order.deliveryBoyStatus || "Not Assigned",
          \`"\${sellerNames.replace(/"/g, '""')}"\`,
          \`₹\${sellerAmount.toFixed(2)}\`,
          \`₹\${order.total?.toFixed(2) || "0.00"}\`,
        ].join(",");
      }),
    ].join("\\n");

    // Fix for Excel encoding: use raw Uint8Array for BOM
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8" });
    
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      \`${prefix}_orders_\${new Date().toISOString().split("T")[0]}.csv\`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };`;

  if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed export in ${file}`);
  } else {
    console.log(`Could not find handleExport in ${file}`);
  }
});
