import { ClientModel } from "./model";
import { connect } from "./net/stream";
import { mountHud } from "./hud";

const model = new ClientModel();
const hud = mountHud(document.getElementById("hud")!, model);
connect("/api/stream", model, (online) => hud.setOnline(online));

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    model.select(undefined);
    model.setFocus(undefined);
  }
});
