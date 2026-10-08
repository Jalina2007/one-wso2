// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { Box, useTheme } from "@wso2/oxygen-ui";
import { sanitizeTilHtml } from "../util/tilRichText";

// react-quill-new, same as every other One WSO2 rich-text field -- draft-js
// has no React 19 support. Toolbar is the minimum that makes a
// multi-paragraph learning readable: bold/italic/underline and lists — no
// link/undo-redo, kept deliberately simple.
const MODULES = {
  toolbar: [["bold", "italic", "underline"], [{ list: "ordered" }, { list: "bullet" }], ["clean"]],
  clipboard: { matchVisual: false, matchers: [] },
};
const FORMATS = ["bold", "italic", "underline", "list", "bullet"];

export default function TilRichTextField({
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        "& .quill": {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          // theme.palette.divider is too faint to read as a border at all on
          // this dark surface (same issue the toolbar icons had) — explicit
          // white at low opacity instead, matching the visible weight of the
          // Who/Where fields' own outlines beside it.
          border: "1px solid rgba(255, 255, 255, 0.3)",
          borderRadius: 1,
        },
        "& .ql-container": {
          fontSize: "inherit",
          fontFamily: "inherit",
          border: "none",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        },
        // Same story as the toolbar icons below: a theme-token color here
        // (text.primary) resolved to something too dark to read on this
        // dark surface, so this is hardcoded white like the icons, not
        // theme-derived — and !important for the same reason: quill's own
        // base styles set color directly on this element too.
        "& .ql-editor": {
          flex: 1,
          overflow: "auto",
          minHeight: 0,
          padding: "12px 15px",
          overflowWrap: "break-word",
          color: "#fff !important",
        },
        // Quill's placeholder defaults to italic -- none of this app's other
        // fields do that (see the Who/Where placeholders beside this one),
        // so drop it for visual consistency.
        "& .ql-editor.ql-blank::before": {
          color: "rgba(255, 255, 255, 0.5) !important",
          fontStyle: "normal",
          left: 15,
          right: 15,
        },
        "& .ql-toolbar": {
          borderTop: "none",
          borderLeft: "none",
          borderRight: "none",
          borderBottom: "1px solid rgba(255, 255, 255, 0.3)",
          flexShrink: 0,
        },
        "& .ql-container.ql-snow, & .ql-toolbar.ql-snow": {
          border: "none",
        },
        // quill.snow.css hardcodes its toolbar icon colors for a light
        // background (a dim grey stroke, #444, and #06c blue on hover),
        // which is both low-contrast and off-brand against this app's dark
        // theme — repaint every icon state. !important because quill.snow.
        // css's own hover/active rule (.ql-snow.ql-toolbar button.ql-active
        // .ql-stroke, etc.) sits at the same specificity as a plain nested
        // selector here, so which one wins is a coin flip decided by import
        // order, not a chain worth relying on. Literal white rather than a
        // theme token: this editor only ever renders on this dialog's dark
        // surface, never a light one, so there's no light/dark variant to
        // account for.
        "& .ql-toolbar .ql-stroke": { stroke: "#fff !important" },
        "& .ql-toolbar .ql-fill": { fill: "#fff !important" },
        "& .ql-toolbar .ql-picker-label": { color: "#fff !important" },
        "& .ql-toolbar button:hover .ql-stroke, & .ql-toolbar button.ql-active .ql-stroke, & .ql-toolbar button:focus .ql-stroke":
          { stroke: `${theme.palette.primary.main} !important` },
        "& .ql-toolbar button:hover .ql-fill, & .ql-toolbar button.ql-active .ql-fill, & .ql-toolbar button:focus .ql-fill":
          { fill: `${theme.palette.primary.main} !important` },
        "& .ql-toolbar button:hover, & .ql-toolbar button.ql-active, & .ql-toolbar button:focus": {
          color: `${theme.palette.primary.main} !important`,
        },
      }}
    >
      <ReactQuill
        theme="snow"
        value={value}
        onChange={(html) => onChange(sanitizeTilHtml(html))}
        placeholder={placeholder}
        modules={MODULES}
        formats={FORMATS}
        readOnly={disabled}
      />
    </Box>
  );
}
