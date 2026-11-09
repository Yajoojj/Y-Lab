import { test, expect } from "@playwright/test";

test("um evento postado no hub aparece no HUD sem erros no console", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/");
  await expect(page.locator(".brand .logo")).toHaveText("Y-LAB");

  const bot = `Smoke Bot ${Date.now()}`;
  const res = await request.post("http://127.0.0.1:7077/api/events", {
    data: { bot, status: "waiting_user", step: "teste e2e" },
  });
  expect(res.status()).toBe(204);

  await expect(page.locator(".waiting").getByText(bot)).toBeVisible({ timeout: 5_000 });

  // o hub marca o bot como concluído para ele não ficar na fila de espera
  await request.post("http://127.0.0.1:7077/api/events", { data: { bot, status: "done", step: "fim do teste" } });

  await page.screenshot({ path: "test-results/smoke.png" });
  expect(errors).toEqual([]);
});
