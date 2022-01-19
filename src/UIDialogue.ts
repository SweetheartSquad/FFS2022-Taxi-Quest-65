import type { EventEmitter } from '@pixi/utils';
import { cubicIn, cubicOut } from 'eases';
import {
	Container,
	Graphics,
	Sprite,
	Text,
	TextMetrics,
	Texture,
} from 'pixi.js';
import { Camera, Mesh3D, ObservablePoint3D, Vec3 } from 'pixi3d';
import Strand from 'strand-core';
import { sfx } from './Audio';
import { fontDialogue, fontPrompt } from './font';
import { game } from './Game';
import { GameObject } from './GameObject';
import { KEYS, keys } from './input-keys';
import { getInput } from './main';
import { Animator } from './Scripts/Animator';
import { Display } from './Scripts/Display';
import { Toggler } from './Scripts/Toggler';
import { Transform } from './Scripts/Transform';
import { size } from './size';
import { Tween, TweenManager } from './Tweens';
import { clamp, lerp, pointOnRect } from './utils';
import { V } from './VMath';

const padding = {
	top: 8,
	bottom: 8,
	left: 16,
	right: 16,
};
const scrimDefault = 0;

function formatLabel(str: string, idx: number, length: number) {
	if (length === 1) return str;
	if (length > 4) return `${idx + 1}. ${str}`;
	if (idx === 0) return `< ${str} <`;
	if (idx === 1) return `> ${str} >`;
	if (idx === 2) return `^ ${str} ^`;
	if (idx === 3) return `v ${str} v`;
	return str;
}

export class UIDialogue extends GameObject {
	sprScrim: Sprite;

	tweenScrim?: Tween;

	tweens: Tween[] = [];

	sprBg: Sprite;

	animatorBg: Animator;

	graphics: Graphics;

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
		return size.y * 0.25;
	}

	closeY() {
		return this.openY() + this.height();
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
		this.sprScrim.width = size.x + 2;
		this.sprScrim.height = size.y + 2;
		this.sprScrim.alpha = 1;
		this.sprBg = new Sprite(Texture.WHITE);
		this.scripts.push(
			(this.animatorBg = new Animator(this, { spr: this.sprBg, freq: 1 / 100 }))
		);
		this.animatorBg.setAnimation('dialogueBg');
		this.sprBg.anchor.y = 0.5;
		this.sprBg.anchor.x = 0.5;
		this.transform.x = 0;

		this.scripts.push((this.toggler = new Toggler(this)));

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
		this.containerChoices.x = this.textText.x =
			-this.sprBg.width / 2 + padding.left;
		this.textText.y = -this.sprBg.height / 2 + padding.top;
		this.textText.style.wordWrap = true;
		this.textText.style.wordWrapWidth =
			this.sprBg.width - padding.left - padding.right;

		this.graphics = new Graphics();
		this.display.container.addChild(this.sprScrim);
		this.display.container.addChild(this.graphics);
		this.display.container.addChild(this.sprBg);
		this.display.container.addChild(this.toggler.container);
		this.sprBg.addChild(this.textText);
		this.sprBg.addChild(this.containerChoices);

		this.sprBg.alpha = 0;
		this.sprBg.y = this.closeY();

		this.sprBg.x = size.x / 2;
		this.sprScrim.x = -this.transform.x - 1;
		this.sprScrim.y = -this.transform.y - 1;
		this.toggler.container.x = -this.transform.x + size.x / 2;
		this.toggler.container.y = -this.transform.y + size.y / 2;

		this.init();
	}

	arrowStart: V = { x: 0, y: 0 };

	arrowEnd: V = { x: 0, y: 0 };

	update(): void {
		super.update();

		// @ts-ignore
		const pointDialogue = window.scene.pointDialogue as Mesh3D;
		// @ts-ignore
		const camera3d = window.scene.camera3d as Camera;

		const min = this.graphics.toLocal({ x: size.x * 0.05, y: size.y * 0.05 });
		const max = this.graphics.toLocal({ x: size.x * 0.95, y: size.y * 0.95 });

		const pos3d = pointDialogue.position;
		let pos = camera3d.worldToScreen(pos3d.x, pos3d.y, pos3d.z);
		const pos3d2a = camera3d.screenToWorld(
			pos.x,
			pos.y,
			1
		) as ObservablePoint3D;
		const pos3d2b = camera3d.screenToWorld(
			pos.x,
			pos.y,
			-1
		) as ObservablePoint3D;
		if (
			// looking away
			Vec3.squaredDistance(pos3d2a.array, pos3d.array) >
			Vec3.squaredDistance(pos3d2b.array, pos3d.array)
		) {
			pos.x = max.x;
			pos.y = lerp(min.y, max.y, 0.25);
		} else {
			pos = this.graphics.toLocal(pos);
		}

		const arrowSize = 20;
		const clampedPos = pointOnRect(pos.x, pos.y, min.x, min.y, max.x, max.y);
		if (clampedPos) {
			pos.x = clampedPos.x;
			pos.y = clampedPos.y;
		}

		if (this.animatorBg.frameChanged) {
			this.arrowEnd.x = lerp(
				this.arrowEnd.x,
				pos.x + (Math.random() - 0.5) * arrowSize * 0.5,
				0.8
			);
			this.arrowEnd.y = lerp(
				this.arrowEnd.y,
				pos.y + (Math.random() - 0.5) * arrowSize * 0.5,
				0.8
			);
			this.sprBg.pivot.x = lerp(0, -pos.x + size.x / 2, 0.1);
			this.sprBg.pivot.y = lerp(0, -pos.y + size.y / 2, 0.1);
		}

		const angle = Math.atan2(pos.y - this.sprBg.y, pos.x - this.sprBg.x);
		const start = this.graphics.toLocal(
			{
				x: (this.sprBg.width - arrowSize * 2) * (Math.cos(angle) * 0.4),
				y: (this.sprBg.height - arrowSize * 2) * (Math.sin(angle) * 0.4),
			},
			this.sprBg
		);
		start.x = clamp(min.x, start.x, max.x);
		start.y = clamp(min.y, start.y, max.y);
		if (this.animatorBg.frameChanged) {
			this.arrowStart.x = lerp(this.arrowStart.x, start.x, 0.9);
			this.arrowStart.y = lerp(this.arrowStart.y, start.y, 0.9);
		}

		this.graphics.clear();
		this.graphics.beginFill(0xffffff);

		this.graphics.drawPolygon([
			this.arrowStart.x,
			this.arrowStart.y + arrowSize,
			this.arrowStart.x,
			this.arrowStart.y - arrowSize,
			this.arrowEnd.x,
			this.arrowEnd.y,
		]);
		this.graphics.drawPolygon([
			this.arrowStart.x + arrowSize,
			this.arrowStart.y,
			this.arrowStart.x - arrowSize,
			this.arrowStart.y,
			this.arrowEnd.x,
			this.arrowEnd.y,
		]);

		this.graphics.endFill();

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
				if (this.choices.length === 1 && input.interact) {
					this.choices[0].emit('click');
				} else if (input.justMoved.y) {
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
			const strText = formatLabel(i.text, idx, a.length);
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
			t.anchor.x = 0.5;
			t.anchor.y = 0.5;
			this.containerChoices.addChild(t);
			return t;
		});
		this.containerChoices.y = 0;
		if (this.choices.length === 1) {
			this.choices[0].x = this.sprBg.width / 2;
		} else if (this.choices.length && this.choices.length <= 4) {
			this.choices[0].x = padding.right;
			this.choices[0].anchor.x = 0;
			this.choices[1].x = this.sprBg.width - padding.left - padding.right;
			this.choices[1].anchor.x = 1;
			if (this.choices.length > 2) {
				this.choices[2].y = -Math.max(...this.choices.map((i) => i.height));
				this.choices[2].x = this.sprBg.width / 2;
			}
			if (this.choices.length > 3) {
				this.choices[3].y = Math.max(...this.choices.map((i) => i.height));
				this.choices[3].x = this.sprBg.width / 2;
			}
		} else {
			// fallback for debug and etc
			this.choices.forEach((i, idx) => {
				i.anchor.x = 0;
				i.y +=
					(this.choices[idx - 1]?.y ?? 0) +
					(this.choices[idx - 1]?.height ?? 0) -
					(i.style.padding || 0) * (idx ? 2 : 0);
			});
		}
		this.containerChoices.y =
			this.sprBg.height / 2 + this.containerChoices.height;
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
			this.scrim(scrimDefault, 500);
			this.tweens.forEach((t) => TweenManager.abort(t));
			this.tweens.length = 0;
			this.tweens.push(
				TweenManager.tween(this.sprBg, 'alpha', 1, 500),
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
