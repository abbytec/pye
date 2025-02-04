import { createCanvas, Image, SKRSContext2D } from "@napi-rs/canvas";
import { Role } from "discord.js";
import { getRoleName } from "../constants.js";
import cardRoles from "../constants/card-roles.js";

function formatNumber(numStr: string) {
	let num = parseFloat(numStr.replace(/,/g, ""));

	if (isNaN(num)) {
		return "-";
	}

	if (num < 1000) {
		return num.toString();
	} else if (num < 1000000) {
		return Math.round(num / 1000).toString() + "k";
	} else {
		return Math.round(num / 1000000).toString() + "M";
	}
}

// Función para dibujar un rectángulo redondeado
function drawRoundedRect(ctx: SKRSContext2D, x: number, y: number, width: number, height: number, radius: number) {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
	ctx.fill();
}

// Función que dibuja texto con un recuadro semitransparente y esquinas redondeadas
function drawTextWithBox(
	ctx: SKRSContext2D,
	text: string,
	x: number,
	y: number,
	{
		font = "bold 30px Rajdhani",
		textColor = "#FFFFFF",
		boxColor = "rgba(0, 0, 0, 0.5)",
		paddingX = 20,
		paddingY = 10,
		radius = 10,
		textAlign = "center",
		textBaseline = "middle",
	}
) {
	ctx.save();
	ctx.font = font;
	ctx.textAlign = textAlign;
	ctx.textBaseline = textBaseline;

	const metrics = ctx.measureText(text);
	const textWidth = metrics.width;
	let textHeight = parseInt(font.match(/\d+/)?.[0] ?? "30", 10);

	// Si se soportan las métricas reales, usarlas para ajustar la altura del recuadro.
	if (metrics.actualBoundingBoxAscent !== undefined && metrics.actualBoundingBoxDescent !== undefined) {
		textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
	}

	const boxWidth = textWidth + paddingX * 2;
	const boxHeight = textHeight + paddingY * 2;

	// Calcular la posición vertical exacta del recuadro según las métricas reales
	const boxX = x - boxWidth / 2;
	const boxY = metrics.actualBoundingBoxAscent !== undefined ? y - metrics.actualBoundingBoxAscent - paddingY : y - textHeight / 2 - paddingY;

	ctx.fillStyle = boxColor;
	drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, radius);

	ctx.fillStyle = textColor;
	ctx.fillText(text, x, y);

	ctx.restore();
}

interface RenderParams {
	name: string;
	role: Role | null;
	points: string;
	rank: string;
	pyeCoins: string;
	foreground: Image;
	avatar: Image;
	customBackground?: Image;
	customDecoration?: Image;
}

export function getRender({ name, role, points, rank, pyeCoins, foreground, avatar, customBackground, customDecoration }: RenderParams) {
	const data = {
		nickName: name[0].toUpperCase() + name.slice(1),
		role: role ? getRoleName(role.id) : "novato",
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

	// Dibujar fondo custom si está disponible
	if (customBackground) {
		ctx.drawImage(customBackground, 0, 0, canvas.width, canvas.height);
	}
	// Dibujar el foreground
	ctx.drawImage(foreground, 0, 0, canvas.width, canvas.height);

	if (customDecoration) {
		ctx.drawImage(customDecoration, 0, 0, canvas.width, canvas.height);
	}

	// AVATAR
	ctx.save();
	ctx.beginPath();
	const circleX = 316;
	const circleY = 243;
	const avatarRadius = 216;
	ctx.arc(circleX, circleY, avatarRadius / 2, 0, Math.PI * 2);
	ctx.closePath();
	ctx.clip();
	ctx.drawImage(avatar, 206, 132, 220, 220);
	ctx.restore();

	// Nickname
	drawTextWithBox(ctx, data.nickName, canvas.width / 2, 420, {
		font: "bold 42px Rajdhani",
		textColor: contentColor,
		boxColor: "rgba(0, 0, 0, 0.5)",
	});

	// Reputación (valor)
	drawTextWithBox(ctx, data.reputation.points, canvas.width / 2, 705, {
		font: "bold 30px Rajdhani",
		textColor: contentColor,
		boxColor: "rgba(0, 0, 0, 0.5)",
	});

	// TOP
	drawTextWithBox(ctx, data.reputation.top, 495, 803, {
		font: "600 30px Rajdhani",
		textColor: contentColor,
		boxColor: "rgba(0, 0, 0, 0.5)",
	});

	// PyE Coins
	drawTextWithBox(ctx, formatNumber(data.pyeCoins), 135, 803, {
		font: "600 30px Rajdhani",
		textColor: contentColor,
		boxColor: "rgba(0, 0, 0, 0.5)",
	});

	// Rango (texto label)
	drawTextWithBox(ctx, label.toUpperCase(), canvas.width / 2, 891, {
		font: "bold 36px Rajdhani",
		textColor: contentColor,
		boxColor: "rgba(0, 0, 0, 0.5)",
	});

	// Título "PyE Coins"
	drawTextWithBox(ctx, "PyE Coins", 139, 764, {
		font: "600 36px Rajdhani",
		textColor: headlineColor,
		boxColor: "rgba(0, 0, 0, 0.5)",
	});

	// Título "Reputación"
	drawTextWithBox(ctx, "Reputación", canvas.width / 2, 664, {
		font: "600 36px Rajdhani",
		textColor: headlineColor,
		boxColor: "rgba(0, 0, 0, 0.5)",
	});

	// Título "Top"
	drawTextWithBox(ctx, "Top", 495, 764, {
		font: "600 36px Rajdhani",
		textColor: headlineColor,
		boxColor: "rgba(0, 0, 0, 0.5)",
	});

	return canvas;
}
