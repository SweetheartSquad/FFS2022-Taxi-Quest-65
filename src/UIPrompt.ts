import { Text } from 'pixi.js';
import { fontPrompt } from './font';
import { GameObject } from './GameObject';
import { getInput, mouse } from './main';
import { Display } from './Scripts/Display';
import { Transform } from './Scripts/Transform';
import { size } from './size';
import { lerp } from './utils';

export class UIPrompt extends GameObject {
	transform: Transform;

	display: Display;

	textPrompt: Text;

	fnPrompt?: () => void;

	strPrompt: string;

	constructor() {
		super();

		this.scripts.push((this.transform = new Transform(this)));
		this.scripts.push((this.display = new Display(this)));
		this.transform.x = 0;

		this.strPrompt = '';
		this.textPrompt = new Text(this.strPrompt, fontPrompt);
		this.textPrompt.alpha = 0;
		this.textPrompt.x = size.x / 2;
		this.textPrompt.y = size.y * 0.75;
		this.textPrompt.anchor.x = 0.5;
		this.textPrompt.anchor.y = 0.5;
		this.display.container.addChild(this.textPrompt);
		this.init();
	}

	update(): void {
		super.update();
		this.textPrompt.alpha = lerp(
			this.textPrompt.alpha,
			this.fnPrompt ? 1 : 0,
			0.1
		);
		const input = getInput();

		if (
			this.textPrompt.alpha > 0.5 &&
			(input.interact || mouse.isJustDown()) &&
			this.fnPrompt
		) {
			this.fnPrompt();
		}
	}

	prompt(
		label: string = this.strPrompt,
		action: (() => void) | undefined = undefined
	) {
		this.strPrompt = label;
		this.textPrompt.text = label;
		this.fnPrompt = action;
	}
}
