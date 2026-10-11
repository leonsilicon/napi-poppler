"use strict";

/**
 * @typedef PdfAttachOptions
 * @property {boolean} [printVersionInfo] Print copyright and version info.
 * @property {boolean} [replace] Replace embedded file with same name (if it exists).
 */

/** @type {Record<keyof PdfAttachOptions, import("../index.js").OptionDetails>} */
export default {
	printVersionInfo: { arg: "-v", type: "boolean" },
	replace: { arg: "-replace", type: "boolean" },
};
