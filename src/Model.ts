/* eslint-disable max-classes-per-file */
import {
	LoaderResource,
	MIPMAP_MODES,
	Program,
	SCALE_MODES,
	Texture,
} from 'pixi.js';
import {
	glTFAsset,
	Material,
	Mesh3D,
	MeshShader,
	Model as Pixi3dModel,
	StandardMaterial,
	StandardMaterialAlphaMode,
} from 'pixi3d';
import { resources } from './Game';
import { GameObject } from './GameObject';
import { getActiveScene } from './main';
import { Animator3d } from './Scripts/Animator3d';
import { tex } from './utils';

const vert = `
attribute vec3 a_Position;
attribute vec2 a_UV1;

varying vec4 v_Position;
varying vec2 v_UV1;

uniform mat4 u_ViewProjection;
uniform mat4 u_Model;

void main() {
  v_Position = u_ViewProjection * u_Model * vec4(a_Position, 1.0);
  v_UV1 = a_UV1;
  gl_Position = v_Position;
}
`;

const frag = `
varying vec4 v_Position;
varying vec2 v_UV1;

uniform sampler2D u_Color;

void main() {
  vec3 color = texture2D(u_Color, v_UV1).rgb;
  const float posterize = 4.0;
  color = mix(color, vec3(1.0/255.0, 11.0/255.0, 17.0/255.0), floor(clamp(0.0, 1.0, length(v_Position/100.0))*posterize)/posterize);
  gl_FragColor = vec4(color, 1.0);
}
`;

class CustomMaterial extends Material {
	baseColorTexture?: Texture;

	updateUniforms(mesh: Mesh3D, shader: MeshShader) {
		shader.uniforms.u_ViewProjection =
			getActiveScene()?.camera3d.viewProjection;
		shader.uniforms.u_Model = mesh.worldTransform.array;
		shader.uniforms.u_Color = this.baseColorTexture;
	}

	createShader() {
		return new MeshShader(Program.from(vert, frag));
	}
}

const materialCache: {
	[key: string]: Material;
} = {};

export class Model extends GameObject {
	model: Pixi3dModel;

	material: Material;

	animator: Animator3d;

	constructor(
		model: string,
		texture: string,
		{
			smooth = false,
			transparent = false,
			doubleSided = false,
			depth = false,
		}: {
			smooth?: boolean;
			transparent?: boolean;
			doubleSided?: boolean;
			depth?: boolean;
		} = {}
	) {
		super();
		const gltf = (
			resources[model] as Maybe<LoaderResource & { gltf?: glTFAsset }>
		)?.gltf;
		if (!gltf) {
			throw new Error(`unknown model ${model}`);
		}
		const matTex = tex(texture);
		let mat: CustomMaterial | StandardMaterial;
		const matKey = `${matTex}_${depth}_${transparent}_${smooth}_${doubleSided}`;
		if (depth) {
			mat = materialCache[matKey] =
				(materialCache[matKey] as CustomMaterial) || new CustomMaterial();
		} else {
			mat = materialCache[matKey] =
				(materialCache[matKey] as StandardMaterial) || new StandardMaterial();
			if (transparent) {
				mat.alphaMode = StandardMaterialAlphaMode.blend;
			}
			mat.unlit = true;
		}
		mat.baseColorTexture = matTex;
		this.model = Pixi3dModel.from(gltf, {
			create: () => mat,
		});
		this.material = mat;
		if (smooth) {
			matTex.baseTexture.mipmap = MIPMAP_MODES.ON;
			matTex.baseTexture.scaleMode = SCALE_MODES.LINEAR;
		}
		mat.doubleSided = doubleSided;
		this.scripts.push(
			(this.animator = new Animator3d(this, {
				mat: {
					getTexture: () => mat.baseColorTexture?.textureCacheIds[0] || '',
					setTexture: (newTexture) => {
						mat.baseColorTexture = tex(newTexture);
					},
				},
			}))
		);
	}

	setAnimation(...args: Parameters<Animator3d['setAnimation']>) {
		return this.animator.setAnimation(...args);
	}

	destroy(): void {
		this.model.destroy({ children: true });
		this.material.destroy();
		super.destroy();
	}
}
