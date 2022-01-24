import { Container, DisplayObject, Graphics } from 'pixi.js';
import { Camera as Camera3D, Mesh3D, Quat } from 'pixi3d';
import { Camera } from './Camera';
import { DEBUG } from './debug';
import { game, resources } from './Game';
import { GameObject } from './GameObject';
import { getInput } from './main';
import { Updater } from './Scripts/Updater';
import { StrandE } from './StrandE';
import { TweenManager } from './Tweens';
import { UIDialogue } from './UIDialogue';
import { lerp } from './utils';
import { distance2 } from './VMath';

function depthCompare(a: DisplayObject, b: DisplayObject): number {
	return a.y - b.y;
}

export class GameScene extends GameObject {
	container = new Container();

	container3d = new Container();

	graphics = new Graphics();

	camera = new Camera();

	camera3d: Camera3D;

	dialogue: UIDialogue;

	strand: StrandE;

	pointDialogue: Mesh3D;

	interactionRegions: {
		x: number;
		y: number;
		range: number;
		label: string;
		action: () => void;
	}[] = [];

	x = 0;

	y = 0;

	constructor() {
		super();
		this.container.addChildAt(this.graphics, 0);

		this.strand = new StrandE({
			source: resources.main.data,
			renderer: {
				displayPassage: (passage) => {
					if (passage.title === 'close') {
						this.dialogue.close();
						return Promise.resolve();
					}
					const program = this.strand.execute(passage.program);
					if (this.strand.voice) {
						this.dialogue.voice = this.strand.voice;
						delete this.strand.voice;
					}
					const text: string[] = [];
					const actions: (typeof program[number] & {
						name: 'action';
					})['value'][] = [];
					program.forEach((node) => {
						switch (node.name) {
							case 'text':
								text.push(node.value);
								break;
							case 'action':
								actions.push(node.value);
								break;
							default:
								throw new Error('unrecognized node type');
						}
					});
					this.dialogue.say(
						text.join('').trim(),
						actions.map((i) => ({
							text: i.text,
							action: () => this.strand.eval(i.action),
						}))
					);
					return Promise.resolve();
				},
			},
		});
		this.strand.scene = this;
		this.strand.debug = DEBUG;
		this.dialogue = new UIDialogue(this.strand);

		this.camera.display.container.addChild(this.container);

		this.pointDialogue = Mesh3D.createCube();
		this.pointDialogue.visible = false;

		this.camera3d = Camera3D.main;

		this.x = 0;
		this.y = 10;
		this.scripts.push(
			new Updater(this, () => {
				const input = getInput();
				this.x += -input.look.x;
				this.y += input.look.y;
				if (this.x < -130) {
					this.x = lerp(this.x, -130, 0.1);
				} else if (this.x > 130) {
					this.x = lerp(this.x, 130, 0.1);
				}
				if (this.y < -70) {
					this.y = lerp(this.y, -70, 0.1);
				} else if (this.y > 70) {
					this.y = lerp(this.y, 70, 0.1);
				}
				this.camera3d.rotationQuaternion.array = Quat.fromEuler(
					this.y,
					this.x + 180,
					0
				);
			})
		);
		this.scripts.push(
			new Updater(this, () => {
				const interaction = this.interactionRegions.find(
					(i) => distance2({ x: this.x, y: this.y }, i) < i.range ** 2
				);
				if (interaction) {
					this.dialogue.prompt(interaction.label, interaction.action);
				} else {
					this.dialogue.prompt();
				}
			})
		);

		this.container3d.addChild(this.pointDialogue);

		game.app.stage.addChild(this.container3d);
		game.app.stage.addChild(this.dialogue.display.container);

		this.strand.history.push('close');
		this.strand.goto('start');
	}

	destroy(): void {
		this.container.destroy({
			children: true,
		});
		super.destroy();
	}

	update(): void {
		if (DEBUG) {
			if (
				this.dialogue.isOpen &&
				this.strand.currentPassage.title === 'debug menu' &&
				getInput().menu
			) {
				this.strand.goto('close');
			} else if (getInput().menu) {
				this.strand.goto('debug menu');
			}
		}

		const curTime = game.app.ticker.lastTime;

		// depth sort
		this.container.children.sort(depthCompare);
		this.container.addChild(this.graphics);

		// adjust camera based on dialogue state
		const p = this.dialogue.progress();
		this.camera.display.container.scale.x =
			this.camera.display.container.scale.y = 1 + p * 0.1;

		const g = this.graphics;

		// test bg
		g.clear();

		const u = this.update;
		// @ts-ignore
		this.update = () => {};
		GameObject.update();
		this.update = u;
		super.update();
		TweenManager.update();
	}
}
