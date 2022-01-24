import { game, resources } from '../Game';
import { GameObject } from '../GameObject';
import { Script } from './Script';

function getFrameCount(animation: string): number {
	let count = 0;
	while (resources[`${animation}.${count + 1}`]?.texture) {
		++count;
	}
	return count;
}

export class Animator3d extends Script {
	mat: { getTexture: () => string; setTexture: (tex: string) => void };

	freq: number;

	offset = 0;

	frameCount!: number;

	private frames: number[] = [];

	frame!: number;

	animation!: string;

	holds: { [frame: number]: number } = {};

	active = true;

	frameChanged = false;

	constructor(
		gameObject: GameObject,
		{ mat, freq = 1 / 200 }: { mat: Animator3d['mat']; freq?: number }
	) {
		super(gameObject);
		this.mat = mat;
		this.freq = freq;
		this.setAnimation(mat.getTexture());
	}

	setAnimation(a: string, holds: { [frame: number]: number } = {}) {
		if (this.animation === a) return;
		const [animation, index] = a.split(/\.(\d+)$/);
		this.animation = animation;
		this.frameCount = getFrameCount(animation);
		this.frames = new Array(this.frameCount)
			.fill(0)
			.flatMap((_, idx) =>
				holds?.[idx + 1] !== undefined
					? new Array(holds[idx + 1]).fill(idx + 1)
					: idx + 1
			);
		this.frame = (this.frameCount ? parseInt(index, 10) - 1 : 0) || 0;
		this.offset = -game.app.ticker.lastTime;
		this.holds = holds;
		this.updateTexture();
	}

	updateTexture() {
		this.mat.setTexture(
			this.frameCount
				? `${this.animation}.${this.frames[this.frame]}`
				: this.animation
		);
	}

	update(): void {
		if (!this.frameCount || !this.active) return;
		const curTime = game.app.ticker.lastTime;
		const oldFrame = this.frame;
		this.frame =
			Math.floor((curTime + this.offset) * this.freq) % this.frames.length;
		this.frameChanged = this.frame !== oldFrame;
		this.updateTexture();
	}
}
