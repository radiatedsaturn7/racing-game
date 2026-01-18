import "./style.css";
import { Renderer } from "./render/Renderer";
import { InputManager } from "./input/InputManager";
import { Hud } from "./ui/Hud";
import { Game } from "./game/Game";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
const hudEl = document.querySelector<HTMLElement>("#hud");
const overlayEl = document.querySelector<HTMLElement>("#overlay");

if (!canvas || !hudEl || !overlayEl) {
  throw new Error("Missing DOM elements");
}

const renderer = new Renderer(canvas);
const input = new InputManager();
const hud = new Hud(hudEl);
const game = new Game(renderer, input, hud, overlayEl);

game.start();
