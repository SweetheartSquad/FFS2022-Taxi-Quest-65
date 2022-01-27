import { AlphaFilter } from '@pixi/filter-alpha';
import type { EventEmitter } from '@pixi/utils';
import { cubicIn, cubicOut } from 'eases';
import {
	Container,
	Graphics,
	Rectangle,
	Sprite,
	Text,
	TextMetrics,
} from 'pixi.js';
import { Camera, Mesh3D, ObservablePoint3D, Vec3 } from 'pixi3d';
import Strand from 'strand-core';
import { sfx } from './Audio';
import { fontChoice, fontDialogue } from './font';
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
import { clamp, lerp, pointOnRect, tex } from './utils';
import { V } from './VMath';

const padding = {
	top: 16,
	bottom: 16,
	left: 32,
	right: 32,
};

function formatLabel(str: string, idx: number, length: number) {
	if (length === 1) return str;
	if (length > 4) return `${idx + 1}. ${str}`;
	return str;
}

export class UIDialogue extends GameObject {
	tweens: Tween[] = [];

	sprBg: Sprite;

	animatorBg: Animator;

	sprChoiceBg: Sprite;

	animatorChoiceBg: Animator;

	sprDiamond: Sprite;

	animatorDiamond: Animator;

	graphics: Graphics;

	transform: Transform;

	display: Display;

	toggler: Toggler;

	isOpen: boolean;

	textText: Text;

	choices: (Text & EventEmitter)[];

	selected: number | undefined;

	containerChoices: Container;

	strText: string;

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
		this.display.container.filters = [new AlphaFilter()];
		this.sprBg = new Sprite(tex('dialogueBg'));
		this.sprChoiceBg = new Sprite(tex('dialogueChoiceBg'));
		this.sprChoiceBg.anchor.x = this.sprChoiceBg.anchor.y = 0.5;
		this.sprChoiceBg.x = this.sprBg.width / 2;
		this.sprDiamond = new Sprite(tex('dialogueDiamond'));
		this.sprDiamond.anchor.x = this.sprDiamond.anchor.y = 0.5;
		this.sprDiamond.x = this.sprBg.width / 2;
		this.scripts.push(
			(this.animatorBg = new Animator(this, { spr: this.sprBg, freq: 1 / 100 }))
		);
		this.scripts.push(
			(this.animatorChoiceBg = new Animator(this, {
				spr: this.sprChoiceBg,
				freq: 1 / 200,
			}))
		);
		this.scripts.push(
			(this.animatorDiamond = new Animator(this, {
				spr: this.sprDiamond,
				freq: 1 / 200,
			}))
		);
		this.animatorDiamond.offset = 100;
		this.sprBg.anchor.y = 0.5;
		this.sprBg.anchor.x = 0.5;
		this.transform.x = 0;

		this.scripts.push((this.toggler = new Toggler(this)));

		this.strText = '';
		this.pos = 0;
		this.posTime = 0;
		this.posDelay = 2;
		this.selected = undefined;
		this.textText = new Text(this.strText, { ...fontDialogue });
		this.display.container.accessible = true;
		this.display.container.interactive = true;
		(this.display.container as EventEmitter).on('pointerdown', () => {
			if (this.isOpen) this.complete();
		});
		this.containerChoices = new Container();
		this.choices = [];
		// @ts-ignore
		window.text = this.textText;
		this.textText.x = -this.sprBg.width / 2 + padding.left;
		this.containerChoices.x = -this.sprBg.width / 2;
		this.textText.y = -this.sprBg.height / 2 + padding.top;
		this.textText.style.wordWrap = true;
		this.textText.style.wordWrapWidth =
			this.sprBg.width - padding.left - padding.right;

		this.graphics = new Graphics();
		this.display.container.addChild(this.graphics);
		this.display.container.addChild(this.sprBg);
		this.display.container.addChild(this.toggler.container);
		this.sprBg.addChild(this.textText);
		this.sprBg.addChild(this.containerChoices);
		this.containerChoices.addChild(this.sprChoiceBg);
		this.containerChoices.addChild(this.sprDiamond);

		this.sprBg.y = this.closeY();
		// @ts-ignore
		this.display.container.filters[0].alpha = 0;

		this.sprBg.x = size.x / 2;
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
			this.sprBg.pivot.x = lerp(
				this.sprBg.pivot.x,
				lerp(0, -pos.x + size.x / 2, 0.1),
				0.5
			);
			this.sprBg.pivot.y = lerp(
				this.sprBg.pivot.y,
				lerp(0, -pos.y + size.y / 2, 0.1),
				0.5
			);
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
		}
		this.arrowStart.y = start.y;

		this.graphics.clear();
		this.graphics.beginFill(0xe0e0e8);

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

		const input = getInput();

		// early return (still opening)
		if (this.progress() < 0.9) return;

		// interaction
		if (this.isOpen && this.choices.length) {
			// make single option clickable from anywhere
			if (this.choices.length === 1) {
				const p = this.choices[0].toGlobal({ x: 0, y: 0 });
				this.choices[0].hitArea = new Rectangle(-p.x, -p.y, size.x, size.y);
			}

			if (input.interact || input.choiceAny) {
				this.complete();
			}
			if (this.containerChoices.alpha > 0.5) {
				if (
					this.choices.length === 1 &&
					(input.choiceLeft ||
						input.choiceRight ||
						input.choiceUp ||
						input.choiceDown)
				) {
					this.choices[0].emit('pointerdown');
				} else if (this.choices.length > 0 && this.choices.length <= 4) {
					if (input.choiceLeft) {
						this.choices[0].emit('pointerdown');
					} else if (input.choiceRight) {
						this.choices[1].emit('pointerdown');
					} else if (this.choices[2] && input.choiceUp) {
						this.choices[2].emit('pointerdown');
					} else if (this.choices[3] && input.choiceDown) {
						this.choices[3].emit('pointerdown');
					}
				} else {
					// keys 1-9 select choices
					this.choices
						.slice(0, 9)
						.find((_, idx) => keys.isJustDown(KEYS.ONE + idx))
						?.emit('pointerdown');

					// menu select
					if (this.selected === undefined) {
						this.selected = 0;
					}
					this.choices[this.selected].alpha = 1;
					if (input.justMoved.y > 0) {
						this.selected =
							this.selected < this.choices.length - 1 ? this.selected + 1 : 0;
					} else if (input.justMoved.y < 0) {
						this.selected =
							this.selected > 0 ? this.selected - 1 : this.choices.length - 1;
					}
					this.choices[this.selected].alpha = 0.75;
					if (input.interact && this.selected !== undefined) {
						this.choices[this.selected].emit('pointerdown');
					}
				}
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
				...fontChoice,
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
			t.on('pointerdown', () => {
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
			this.choices[0].x = this.sprChoiceBg.x - (this.sprDiamond.width / 2 + 5);
			this.choices[0].y = this.sprChoiceBg.y;
			this.choices[0].anchor.x = 1;
			this.choices[1].x = this.sprChoiceBg.x + (this.sprDiamond.width / 2 + 5);
			this.choices[1].y = this.sprChoiceBg.y;
			this.choices[1].anchor.x = 0;
			if (this.choices.length > 2) {
				this.choices[2].x = this.sprBg.width / 2;
				this.choices[2].y =
					this.sprChoiceBg.y - (this.sprDiamond.height / 2 + 5);
				this.choices[2].anchor.y = 1;
			}
			if (this.choices.length > 3) {
				this.choices[3].x = this.sprBg.width / 2;
				this.choices[3].y =
					this.sprChoiceBg.y + (this.sprDiamond.height / 2 + 5);
				this.choices[3].anchor.y = 0;
			}
			this.sprChoiceBg.visible = false;
			this.sprChoiceBg.width = Math.max(
				this.containerChoices.width * 1.3,
				this.sprChoiceBg.texture.width
			);
			this.sprChoiceBg.height = Math.max(
				this.containerChoices.height * 1.3,
				this.sprChoiceBg.texture.height
			);
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
		this.sprChoiceBg.visible =
			this.choices.length > 0 &&
			this.choices.length <= 4 &&
			!!this.choices[0].text.trim();
		this.sprDiamond.visible =
			this.choices.length >= 2 && this.choices.length <= 4;
		this.containerChoices.y = this.sprBg.height / 2 + padding.bottom;
		this.containerChoices.alpha = 0.0;
		this.open();
		this.pos = 0;
		this.posTime = 0;
	}

	show(...args: Parameters<Toggler['show']>) {
		return this.toggler.show(...args);
	}

	complete() {
		if (this.pos >= this.strText.length) return;
		this.pos = this.strText.length;
		this.textText.text = this.strText;
	}

	private open() {
		if (!this.isOpen) {
			this.isOpen = true;
			this.tweens.forEach((t) => TweenManager.abort(t));
			this.tweens.length = 0;
			this.tweens.push(
				// @ts-ignore
				TweenManager.tween(this.display.container.filters[0], 'alpha', 1, 500),
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
			this.choices.forEach((i) => {
				i.interactive = false;
			});
			this.isOpen = false;
			this.tweens.forEach((t) => TweenManager.abort(t));
			this.tweens.length = 0;
			this.tweens.push(
				// @ts-ignore
				TweenManager.tween(this.display.container.filters[0], 'alpha', 0, 500),
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
}
