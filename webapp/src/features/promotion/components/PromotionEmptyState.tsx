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

import type { ReactNode } from "react";
import { Box, Typography } from "@wso2/oxygen-ui";

// Mirrors source's own StateWithImage (component/ui/stateWithImage.tsx) —
// an icon beside message text, one per state (no pending requests, no open
// cycle, past deadline, load failure). Source uses a different SVG
// illustration per state; this uses a different lucide icon + tone per
// state instead, the same substitution PAR's own ParEmptyState already
// makes for its one source image (par-app's NoDataView.tsx).
export default function PromotionEmptyState({
  icon,
  message,
  tone = "primary",
}: {
  icon: ReactNode;
  message: string;
  tone?: "primary" | "warning" | "error";
}) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", textAlign: "center", py: 6 }}>
      <Box sx={{ color: `${tone}.main`, mr: 1.5, display: "flex" }}>{icon}</Box>
      <Typography variant="h6" sx={{ color: `${tone}.main`, fontWeight: 700 }}>
        {message}
      </Typography>
    </Box>
  );
}
