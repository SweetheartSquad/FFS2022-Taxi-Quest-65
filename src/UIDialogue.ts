import type { EventEmitter } from '@pixi/utils';
import { cubicIn, cubicOut } from 'eases';
import { Container, Sprite, Text, TextMetrics, Texture } from 'pixi.js';
import Strand from 'strand-core';
import { sfx } from './Audio';
import { fontDialogue, fontPrompt } from './font';
import { game } from './Game';
import { GameObject } from './GameObject';
import { KEYS, keys } from './input-keys';
import { getInput } from './main';
import { Display } from './Scripts/Display';
import { Toggler } from './Scripts/Toggler';
import { Transform } from './Scripts/Transform';
import { size } from './size';
import { Tween, TweenManager } from './Tweens';
import { lerp, tex } from './utils';

const padding = {
	top: 4,
	bottom: 4,
	left: 8,
	right: 8,
};
export class UIDialogue extends GameObject {
	sprScrim: Sprite;

	tweenScrim?: Tween;

	tweens: Tween[] = [];

	sprBg: Sprite;

	transform: Transform;

	display: Display;

	toggler: Toggler;

	isOpen: boolean;

	textText: Text;

	textPrompt: Text;

	fnPrompt?: () => void;

	choices: (Text & EventEmitter)[];

	selected: number | undefined;

	containerChoices: Container;

	strText: string;

	strPrompt: string;

	strand: Strand;

	private pos: number;

	private posTime: number;

	private posDelay: number;

	voice = 'Default' as string | undefined;

	height() {
		return this.sprBg.height;
	}

	openY() {
		return size.y;
	}

	closeY() {
		return size.y + this.height();
	}

	progress() {
		return (
			Math.abs(this.sprBg.y - this.closeY()) /
			Math.abs(this.openY() - this.closeY())
		);
	}

	constructor(strand: Strand) {
		super();

		this.strand = strand;
		this.isOpen = false;
		this.scripts.push((this.transform = new Transform(this)));
		this.scripts.push((this.display = new Display(this)));
		this.display.container.interactiveChildren = true;
		this.sprScrim = new Sprite(Texture.WHITE);
		this.sprScrim.tint = 0x000000;
		this.sprScrim.width = size.x;
		this.sprScrim.height = size.y;
		this.sprScrim.alpha = 1;
		this.sprBg = new Sprite(tex('dialogueBg'));
		this.sprBg.anchor.y = 1.0;
		this.transform.x = 0;

		this.scripts.push((this.toggler = new Toggler(this)));
		this.toggler.container.x += size.x / 2;
		this.toggler.container.y = size.y / 2 - this.sprBg.height / 2;

		this.strText = '';
		this.strPrompt = '';
		this.pos = 0;
		this.posTime = 0;
		this.posDelay = 2;
		this.selected = undefined;
		this.textText = new Text(this.strText, { ...fontDialogue });
		this.textPrompt = new Text(this.strPrompt, fontPrompt);
		this.textPrompt.alpha = 0;
		this.textPrompt.x = size.x / 2;
		this.textPrompt.y = 10;
		this.textPrompt.anchor.x = 0.5;
		this.display.container.addChild(this.textPrompt);
		this.display.container.accessible = true;
		this.display.container.interactive = true;
		(this.display.container as EventEmitter).on('click', () => {
			this.complete();
		});
		this.containerChoices = new Container();
		this.containerChoices.x = padding.left;
		this.choices = [];
		// @ts-ignore
		window.text = this.textText;
		this.textText.y = -this.sprBg.height + padding.top;
		this.textText.x = padding.left;
		this.textText.style.wordWrap = true;
		this.textText.style.wordWrapWidth =
			this.sprBg.width - padding.left - padding.right;

		this.display.container.addChild(this.sprScrim);
		this.display.container.addChild(this.sprBg);
		this.display.container.addChild(this.toggler.container);
		this.display.container.addChild(this.textText);
		this.display.container.addChild(this.containerChoices);

		this.sprBg.alpha = 0;
		this.textText.alpha = 0;
		this.sprBg.y = this.closeY();

		this.transform.x = size.x / 2 - this.sprBg.width / 2;
		this.transform.y = -size.y / 2 - this.height() / 2;
		this.sprScrim.x = -this.transform.x;
		this.sprScrim.y = -this.transform.y;
		this.toggler.container.x = -this.transform.x + size.x / 2;
		this.toggler.container.y = -this.transform.y + size.y / 2;

		this.init();
	}

	update(): void {
		super.update();
		this.textText.pivot.x = -this.sprBg.x;
		this.textText.pivot.y = -this.sprBg.y;
		this.containerChoices.pivot.x = -this.sprBg.x;
		this.containerChoices.pivot.y = -this.sprBg.y;
		this.textPrompt.alpha = lerp(
			this.textPrompt.alpha,
			!this.isOpen && this.fnPrompt ? 1 : 0,
			0.1
		);
		const input = getInput();

		if (!this.isOpen && input.interact && this.fnPrompt) {
			this.fnPrompt();
		}

		// early return (still opening)
		if (this.progress() < 0.9) return;

		if (this.isOpen && this.choices.length) {
			if (this.containerChoices.alpha > 0.5) {
				if (input.justMoved.y) {
					if (this.selected !== undefined) {
						this.choices[this.selected].alpha = 1;
					}
					if (this.selected === undefined) {
						this.selected = 0;
					} else if (input.justMoved.y > 0) {
						this.selected =
							this.selected < this.choices.length - 1 ? this.selected + 1 : 0;
					} else if (input.justMoved.y < 0) {
						this.selected =
							this.selected > 0 ? this.selected - 1 : this.choices.length - 1;
					}
					this.choices[this.selected].alpha = 0.75;
				} else if (input.interact && this.selected !== undefined) {
					this.choices[this.selected].emit('click');
				} else if (input.interact) {
					this.complete();
				} else {
					this.choices
						.find((_, idx) => keys.isJustDown(KEYS.ONE + idx))
						?.emit('click');
				}
			} else if (input.interact) {
				this.complete();
			}
		}

		this.containerChoices.alpha = lerp(
			this.containerChoices.alpha,
			this.pos > this.strText.length ? 1 : 0,
			0.1
		);

		// early return (animation complete)
		if (this.pos > this.strText.length) return;
		this.posTime += game.app.ticker.deltaTime;
		const prevPos = this.pos;
		while (this.posTime > this.posDelay) {
			this.pos += 1;
			this.posTime -= this.posDelay;
		}
		if (prevPos !== this.pos) {
			const letter = this.strText?.[this.pos]?.replace(/[^\w]/, '');
			if (this.pos % 2 && letter && this.voice !== 'None') {
				sfx(`voice${this.voice}`, {
					rate: (letter.charCodeAt(0) % 30) / 30 + 0.5,
				});
			}
			this.textText.text = this.strText.substring(0, this.pos);
		}
	}

	say(text: string, actions?: { text: string; action: () => void }[]) {
		this.selected = undefined;

		this.strText = TextMetrics.measureText(
			text,
			// @ts-ignore
			this.textText.style,
			true
		).lines.join('\n');

		this.textText.text = '';
		this.display.container.accessibleHint = text;
		this.choices.forEach((i) => i.destroy());
		this.choices = (actions || []).map((i, idx, a) => {
			const strText = a.length > 1 ? `${idx + 1}. ${i.text}` : i.text;
			const t = new Text(strText, {
				...this.textText.style,
				wordWrapWidth: (this.textText.style.wordWrapWidth || 0) - 2,
			}) as Text & EventEmitter;
			t.accessible = true;
			t.accessibleHint = strText;
			t.interactive = true;
			t.buttonMode = true;
			t.tabIndex = 0;

			t.on('pointerover', () => {
				t.alpha = 0.75;
				this.selected = idx;
			});
			t.on('pointerout', () => {
				t.alpha = 1;
				this.selected = undefined;
			});
			t.on('click', () => {
				if (this.containerChoices.alpha > 0.5) {
					i.action();
				}
			});
			t.anchor.x = 0;
			t.y +=
				this.containerChoices.height - (t.style.padding || 0) * (idx ? 2 : 0);
			this.containerChoices.addChild(t);
			return t;
		});
		this.containerChoices.y = -this.containerChoices.height - padding.bottom;
		this.containerChoices.alpha = 0.0;
		this.open();
		this.pos = 0;
		this.posTime = 0;
	}

	show(...args: Parameters<Toggler['show']>) {
		return this.toggler.show(...args);
	}

	prompt(
		label: string = this.strPrompt,
		action: (() => void) | undefined = undefined
	) {
		this.strPrompt = label;
		this.textPrompt.text = label;
		this.fnPrompt = action;
	}

	complete() {
		if (this.pos >= this.strText.length) return;
		this.pos = this.strText.length;
		this.textText.text = this.strText;
	}

	private open() {
		if (!this.isOpen) {
			this.isOpen = true;
			this.scrim(0.25, 500);
			this.tweens.forEach((t) => TweenManager.abort(t));
			this.tweens.length = 0;
			this.tweens.push(
				TweenManager.tween(this.sprBg, 'alpha', 1, 500),
				TweenManager.tween(this.textText, 'alpha', 1, 500),
				TweenManager.tween(
					this.sprBg,
					'y',
					this.openY(),
					500,
					undefined,
					cubicOut
				)
			);
		}
	}

	close() {
		if (this.isOpen) {
			this.isOpen = false;
			this.scrim(0, 500);
			this.tweens.forEach((t) => TweenManager.abort(t));
			this.tweens.length = 0;
			this.tweens.push(
				TweenManager.tween(this.sprBg, 'alpha', 0, 500),
				TweenManager.tween(this.textText, 'alpha', 0, 500),
				TweenManager.tween(this.containerChoices, 'alpha', 0, 500),
				TweenManager.tween(
					this.sprBg,
					'y',
					this.closeY(),
					500,
					undefined,
					cubicIn
				)
			);
		}
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
