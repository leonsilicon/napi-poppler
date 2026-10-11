"use strict";

/**
 * @typedef PdfUniteOptions
 * @property {boolean} [printVersionInfo] Print copyright and version information.
 */

/** @type {Record<keyof PdfUniteOptions, import("../index.js").OptionDetails>} */
export default {
	printVersionInfo: { arg: "-v", type: "boolean" },
};
