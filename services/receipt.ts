interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

export const createReceiptHtml = (order: any) => {
    const itemsHtml = order.items.map((item: CartItem) => `
        <div class="item-row">
            <div class="qty-name">
                <span class="qty">${item.quantity}</span>
                <span class="name">${item.name}</span>
            </div>
            <div class="price">${(item.price * item.quantity).toFixed(0)}</div>
        </div>
    `).join('');

    const addressHtml = order.orderType === 'Delivery' && order.address ? `
        <div class="section-box">
            <div class="label">DELIVERY ADDRESS</div>
            <div class="value large">${order.address}</div>
        </div>
    ` : '';

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Receipt</title>
                <style>
                    @page { size: 80mm auto; margin: 0; }
                    body { 
                        width: 72mm; margin: 0 auto; padding: 10px 0 20px 0; 
                        background-color: #fff; color: #000; 
                        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                        font-size: 12px; line-height: 1.4;
                    }
                    .center { text-align: center; }
                    .bold { font-weight: 700; }
                    .divider { border-bottom: 2px solid #000; margin: 8px 0; }
                    .divider-thin { border-bottom: 1px dashed #000; margin: 8px 0; }
                    .logo { max-width: 50px; display: block; margin: 0 auto 5px; opacity: 0.8; }
                    .brand { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
                    .meta { font-size: 10px; color: #333; }
                    .info-grid { display: flex; flex-wrap: wrap; margin-top: 10px; }
                    .info-item { width: 50%; margin-bottom: 4px; }
                    .label { font-size: 9px; text-transform: uppercase; color: #444; }
                    .value { font-size: 11px; font-weight: 700; }
                    .value.large { font-size: 12px; }
                    .item-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
                    .qty-name { display: flex; align-items: flex-start; flex: 1; padding-right: 5px; }
                    .qty { font-weight: 700; min-width: 20px; }
                    .name { flex: 1; }
                    .price { font-weight: 700; white-space: nowrap; }
                    .total-section { margin-top: 10px; padding-top: 5px; border-top: 2px solid #000; }
                    .total-row { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
                    .total-label { font-size: 14px; font-weight: 700; text-transform: uppercase; }
                    .total-amount { font-size: 18px; font-weight: 900; }
                    .section-box { border: 1px solid #000; border-radius: 4px; padding: 5px; margin: 10px 0; background: #f8f8f8; -webkit-print-color-adjust: exact; }
                    .footer { text-align: center; margin-top: 20px; font-size: 10px; }
                    .order-id { font-size: 14px; font-weight: 700; margin-top: 5px; border: 1px solid #000; display: inline-block; padding: 2px 8px; border-radius: 4px; }
                    .credit { margin-top: 15px; text-align: center; font-size: 9px; color: #555; text-transform: uppercase; border-top: 1px solid #ddd; padding-top: 5px; }
                    ::-webkit-scrollbar { display: none; }
                </style>
            </head>
            <body>
                <div class="center">
                    <img src="https://i.ibb.co/6R223hD/slice-n-spice.png" class="logo" alt="Logo" onerror="this.style.display='none'" />
                    <div class="brand">Slice n' Spice</div>
                    <div class="meta">${new Date(order.date).toLocaleDateString()} &bull; ${new Date(order.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
                <div class="divider"></div>
                <div class="info-grid">
                    <div class="info-item"><div class="label">Type</div><div class="value">${order.orderType}</div></div>
                    <div class="info-item"><div class="label">Payment</div><div class="value">${order.paymentMethod}</div></div>
                    <div class="info-item"><div class="label">Customer</div><div class="value">${order.customerName || 'Walk-in'}</div></div>
                     <div class="info-item"><div class="label">Staff</div><div class="value">${order.staffName}</div></div>
                </div>
                ${order.customerPhone ? `<div style="margin-top: 4px;"><div class="label">Contact</div><div class="value">${order.customerPhone}</div></div>` : ''}
                <div class="divider-thin"></div>
                <div style="min-height: 50px;">${itemsHtml}</div>
                <div class="total-section">
                    <div class="total-row"><span class="total-label">Total</span><span class="total-amount">PKR ${order.total.toFixed(0)}</span></div>
                </div>
                ${addressHtml}
                <div class="footer"><div>Thank you for your order!</div><div class="order-id">#${order.orderNumber || '---'}</div></div>
                <div class="credit">Designed by Infinity Crafters</div>
            </body>
        </html>
    `;
};
