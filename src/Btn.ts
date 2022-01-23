import { Sprite } from 'pixi.js';
import { sfx } from './Audio';
import { GameObject } from './GameObject';
import { Display } from './Scripts/Display';
import { tex } from './utils';

export class Btn extends GameObject {
	display: Display;

	constructor(public onClick: () => void, texture: string) {
		super();
		this.scripts.push((this.display = new Display(this)));

		const spr = new Sprite(tex(`${texture}_normal`));
		this.display.container.addChild(spr);
		this.display.container.interactiveChildren = true;
		spr.anchor.x = spr.anchor.y = 0.5;
		spr.accessible = true;
		spr.accessibleHint = texture;
		spr.interactive = true;
		spr.buttonMode = true;
		spr.tabIndex = 0;
		spr.on('click', onClick);
		spr.on('pointerover', () => {
			spr.texture = tex(`${texture}_over`);
		});
		spr.on('pointerdown', () => {
			spr.texture = tex(`${texture}_down`);
			setTimeout(() => {
				spr.texture = tex(`${texture}_normal`);
			}, 100);
			sfx(texture, { rate: Math.random() * 0.2 + 0.9 });
		});
		spr.on('pointerout', () => {
			spr.texture = tex(`${texture}_normal`);
		});
	}
}
