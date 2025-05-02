import { decode } from "html-entities";
import { Node, parse, HTMLElement } from "node-html-parser";

/**
 * Convierte un fragmento HTML a Markdown (Discord-friendly).
 *
 * - <p>      → 1 línea en blanco
 * - <code>   → `código`
 * - <pre>    → ``` … ```
 * - <ul><li> → "- ítem"
 * - <strong>/<b> → **texto**
 * - <em>/<i> → *texto*
 * - <sup>    → ^superíndice
 */
function htmlToMarkdown(html: string): string {
	const root = parse(html, { lowerCaseTagName: true, comment: false });

	function recurse(node: Node): string {
		/* ---------- elementos ---------- */
		const tag = (node as HTMLElement).tagName?.toLowerCase();

		/* ---------- texto ---------- */
		if (node.nodeType === 3) {
			// ignora nodos de puro espacio / salto de línea
			if (tag === "pre" && node.rawText.includes("<")) {
				// node.innerText conserva los saltos y elimina etiquetas internas
				const txt = htmlToMarkdown((node as HTMLElement).innerText);
				return `\`\`\`md\n${txt.trimEnd()}\n\`\`\`\n\n`;
			} else return /^\s*$/.test(node.rawText) ? "" : decode(node.rawText);
		}

		switch (tag) {
			case "p": {
				const text = node.childNodes.map(recurse).join("").trim();
				// párrafo vacío (p&nbsp; o p<br>) ⇒ sólo un salto
				return text ? `${text}\n\n` : "\n";
			}

			case "strong":
			case "b":
				return `**${node.childNodes.map(recurse).join("")}**`;

			case "em":
			case "i":
				return `*${node.childNodes.map(recurse).join("")}*`;

			case "ul": {
				const items = node.childNodes
					.filter((n) => (n as HTMLElement).tagName?.toLowerCase() === "li")
					.map(recurse)
					.join("\n");
				return `${items}\n`;
			}

			case "ol": {
				let idx = 1;
				const items = node.childNodes
					.filter((n) => (n as HTMLElement).tagName?.toLowerCase() === "li")
					.map((li) => {
						const content = li.childNodes.map(recurse).join("").trim();
						return `${idx++}. ${content}\n`;
					})
					.join("");
				return `${items}\n`;
			}

			case "li":
				return `- ${node.childNodes.map(recurse).join("").trim()}`;

			case "code":
				return `\`${node.childNodes.map(recurse).join("").replace(/`/g, "\\`")}\``;

			case "pre": {
				// node.innerText conserva los saltos y elimina etiquetas internas
				if (node.innerText.includes("<")) return `\`\`\`md\n${htmlToMarkdown((node as HTMLElement).innerText).trimEnd()}\n\`\`\`\n\n`;
				const txt = decode((node as HTMLElement).innerText);
				return `\`\`\`md\n${txt.trimEnd()}\n\`\`\`\n\n`;
			}

			case "sup":
				return `^${node.childNodes.map(recurse).join("")}`;

			case "br":
				return "\n";

			default:
				return node.childNodes.map(recurse).join("");
		}
	}

	// salida final
	let out = root.childNodes.map(recurse).join("");

	// comprime >2 saltos consecutivos a exactamente 2
	out = out.replace(/\n{3,}/g, "\n\n").trimEnd();

	return out;
}

export { htmlToMarkdown };
