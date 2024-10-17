import { createCanvas, Image } from "@napi-rs/canvas";
import { Role } from "discord.js";
import { getRoleName } from "../constants.ts";
import cardRoles from "../constants/card-roles.ts";

function formatNumber(numStr: string) {
	let num = parseFloat(numStr.replace(/,/g, ""));

	if (isNaN(num)) {
		return "-";
	}

	if (num < 1000) {
		return num.toString();
	} else if (num < 1000000) {
		// Redondea al millar más cercano y luego divide por 1000
		return Math.round(num / 1000).toString() + "k";
	} else {
		// Redondea al millón más cercano y luego divide por 1000000
		return Math.round(num / 1000000).toString() + "M";
	}
}

/**
 * get render canvas
 *
 * @param {object} params - Objeto con los parámetros.
 * @param {string} params.name - User name
 * @param {import('discord.js').Role} params.role - role object
 * @param {string} params.points - Reputation points
 * @param {string} params.rank - Reputation rank.
 * @param {string} params.pyeCoins - PyE coins of the suer.
 * @param {import('canvas').Image} params.background - backround image path.
 * @param {import('canvas').Image} params.avatar - url path'.
 */

interface RenderParams {
	name: string;
	role: Role;
	points: string;
	rank: string;
	pyeCoins: string;
	background: Image;
	avatar: Image;
}
export function getRender({ name, role, points, rank, pyeCoins, background, avatar }: RenderParams) {
	const data = {
		nickName: name[0].toUpperCase() + name.slice(1),
		role: getRoleName(role.id),
		avatar: avatar,
		pyeCoins: pyeCoins,
		reputation: {
			points: points,
			top: rank == "0" ? "-" : rank,
		},
	};

	const { headlineColor, contentColor, label } = cardRoles[data.role];

	const canvas = createCanvas(632, 941);
	const ctx = canvas.getContext("2d");

	ctx.imageSmoothingEnabled = false;

	ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
	ctx.save();

	/**
	 * Dynamic section
	 */

	// AVATAR data
	// avatar circle clip
	ctx.beginPath();
	const circleX = 316; // 132.5
	const circleY = 243; // 120.6
	const avatarRadius = 216;
	ctx.arc(circleX, circleY, avatarRadius / 2, 0, Math.PI * 2);
	ctx.closePath();
	ctx.clip();
	// avatar image inside circle
	const avatarX = 206;
	const avatarY = 132;
	const avatarW = 220;
	const avatarH = 220;
	ctx.drawImage(avatar, avatarX, avatarY, avatarW, avatarH);

	// NICKNAME data
	const nickItem = {
		text: data.nickName,
		x: canvas.width / 2,
		y: 420,
		fontSize: 42,
	};
	ctx.restore();
	ctx.fillStyle = contentColor;
	ctx.font = `bold ${nickItem.fontSize}px Rajdhani`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(nickItem.text, nickItem.x, nickItem.y);

	// REP data
	ctx.restore();
	const reputation = {
		x: canvas.width / 2, // TODO: center with measure text??
		y: 705,
		fontSize: 30,
	};
	ctx.font = `bold ${reputation.fontSize}px Rajdhani`;
	ctx.fillStyle = contentColor;
	ctx.textAlign = "center";
	ctx.fillText(data.reputation.points, reputation.x, reputation.y);

	// TOP data
	ctx.restore();
	const topRep = {
		x: 495,
		y: 803,
		fontSize: 30,
	};
	ctx.font = `600 ${topRep.fontSize}px Rajdhani`;
	ctx.fillStyle = contentColor;
	ctx.textAlign = "center";
	ctx.fillText(data.reputation.top, topRep.x, topRep.y);

	// PYE COINS data
	ctx.restore();
	const pyeCoinsConfig = {
		x: 135,
		y: 803,
		fontSize: 30,
	};
	ctx.font = `600 ${pyeCoinsConfig.fontSize}px Rajdhani`;
	ctx.textAlign = "center";
	ctx.fillStyle = contentColor;
	ctx.fillText(formatNumber(data.pyeCoins).toLocaleString(), pyeCoinsConfig.x, pyeCoinsConfig.y);

	// RANGO data
	ctx.restore();
	const rango = {
		text: label,
		x: canvas.width / 2,
		y: 891,
		fontSize: 36,
	};
	ctx.restore();
	ctx.fillStyle = contentColor;
	ctx.font = `bold ${rango.fontSize}px Rajdhani`;
	ctx.textAlign = "center";
	ctx.fillText(rango.text.toLocaleUpperCase(), rango.x, rango.y);

	/**
	 *  Static section, only color might change
	 */
	// PYE COINS title
	ctx.restore();
	const pyeCoinsTitle = {
		x: 139, // TODO: center with measure text??
		y: 764,
		fontSize: 36,
	};
	ctx.font = `600 ${pyeCoinsTitle.fontSize}px Rajdhani`;
	ctx.textAlign = "center";
	ctx.fillStyle = headlineColor;
	ctx.fillText("PyE Coins", pyeCoinsTitle.x, pyeCoinsTitle.y);

	// rep title
	ctx.restore();
	const repTitle = {
		x: canvas.width / 2,
		y: 664,
		fontSize: 36,
	};
	ctx.font = `600 ${repTitle.fontSize}px Rajdhani`;
	ctx.textAlign = "center";
	ctx.fillStyle = headlineColor;
	ctx.fillText("Reputación", repTitle.x, repTitle.y);

	// top title
	ctx.restore();
	const topTitle = {
		x: 495,
		y: 764,
		fontSize: 36,
	};
	ctx.font = `600 ${topTitle.fontSize}px Rajdhani`;
	ctx.textAlign = "center";
	ctx.fillStyle = headlineColor;
	ctx.fillText("Top", topTitle.x, topTitle.y);

	return canvas;
}
