import { createServer } from "node:http";

export async function createFixture(ui: "old" | "new", buggy: boolean) {
  const orders: number[] = [];
  const ids =
    ui === "old"
      ? ["quantity", "shipping", "coupon", "place"]
      : ["cart-qty", "delivery", "offer", "confirm"];
  const html = `<!doctype html><html lang="en"><title>Controlled checkout</title><body>
    <h1>Checkout</h1><form>
    <label for="${ids[0]}">Quantity</label><input id="${ids[0]}" type="number" value="1" min="1" max="10">
    <label for="${ids[1]}">Shipping</label><select id="${ids[1]}"><option value="standard">Standard</option><option value="express">Express</option></select>
    <label for="${ids[2]}">Coupon</label><input id="${ids[2]}">
    <button id="${ids[3]}" type="submit">Place order</button></form>
    <p role="status" aria-label="Order acknowledgement"></p><output aria-label="Charged amount"></output>
    <script>document.querySelector('form').onsubmit=async(event)=>{
      event.preventDefault();
      const response=await fetch('/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        quantity:Number(document.getElementById('${ids[0]}').value),shipping:document.getElementById('${ids[1]}').value,coupon:document.getElementById('${ids[2]}').value
      })});
      if(!response.ok) throw new Error('Order rejected');
      const result=await response.json();
      document.querySelector('[role=status]').textContent='Order received';
      document.querySelector('output').textContent='$'+(result.chargedCents/100).toFixed(2);
    };</script></body></html>`;
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
      return;
    }
    if (request.method !== "POST" || request.url !== "/order") {
      response.writeHead(404).end();
      return;
    }
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > 8192) request.destroy();
    });
    request.on("end", () => {
      try {
        const input: unknown = JSON.parse(body);
        if (!input || typeof input !== "object") throw new Error("Invalid input");
        const values = input as Record<string, unknown>;
        if (
          !Number.isInteger(values.quantity) ||
          Number(values.quantity) < 1 ||
          Number(values.quantity) > 10 ||
          !["standard", "express"].includes(String(values.shipping)) ||
          typeof values.coupon !== "string"
        )
          throw new Error("Invalid input");
        const chargedCents =
          Number(values.quantity) * 1000 +
          (values.shipping === "express" ? 500 : 0) -
          (!buggy && values.coupon === "FLAT2" ? 200 : 0);
        orders.push(chargedCents);
        response
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify({ chargedCents }));
      } catch {
        response.writeHead(400).end();
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No fixture port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    readCommittedCharges: () => [...orders],
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
