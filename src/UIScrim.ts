import { Sprite, Texture } from 'pixi.js';
import { GameObject } from './GameObject';
import { Display } from './Scripts/Display';
import { Transform } from './Scripts/Transform';
import { size } from './size';
import { Tween, TweenManager } from './Tweens';

export class UIScrim extends GameObject {
	sprScrim: Sprite;

	tweenScrim?: Tween;

	tweens: Tween[] = [];

	transform: Transform;

	display: Display;

	voice = 'Default' as string | undefined;

	constructor() {
		super();

		this.scripts.push((this.transform = new Transform(this)));
		this.scripts.push((this.display = new Display(this)));
		this.sprScrim = new Sprite(Texture.WHITE);
		this.sprScrim.tint = 0x000000;
		this.sprScrim.width = size.x + 2;
		this.sprScrim.height = size.y + 2;
		this.sprScrim.alpha = 0;
		this.transform.x = 0;
		this.display.container.addChild(this.sprScrim);

		this.sprScrim.x = -this.transform.x - 1;
		this.sprScrim.y = -this.transform.y - 1;

		this.init();
	}

	scrim(amount: number, duration: number) {
		if (this.tweenScrim) TweenManager.abort(this.tweenScrim);
		this.tweenScrim = TweenManager.tween(
			this.sprScrim,
			'alpha',
			amount,
			duration
		);
	}
}
