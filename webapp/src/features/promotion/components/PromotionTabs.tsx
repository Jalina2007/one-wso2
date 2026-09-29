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

import type { ReactElement } from "react";
import { Link, useLocation } from "react-router";
import { Tab, Tabs } from "@wso2/oxygen-ui";

// A tab strip matching promotion-app's own icon+label Tabs bar (lead.tsx,
// functionalLead.tsx, etc. all use the same MUI `<Tabs>`/`<Tab icon={...}
// label={...}>` shape) — visually source's own, but URL-driven like this
// app's shared RoutedTabs rather than source's own `?tab=` query param, so
// a tab is linkable/survives a refresh/works with the back button. Source's
// own visual (icon left of label, divider under the strip) lives in
// PromotionPageShell + here rather than in the shared RoutedTabs component,
// which renders a smaller, icon-less bar unrelated to how this app's own
// screens actually look.
export interface PromotionTabDef {
  segment: string;
  label: string;
  icon: ReactElement;
}

export default function PromotionTabs({
  basePath,
  tabs,
  ariaLabel,
}: {
  basePath: string;
  tabs: readonly PromotionTabDef[];
  ariaLabel: string;
}) {
  const { pathname } = useLocation();
  const rest = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : "";
  const current = rest.replace(/^\//, "").split("/")[0];
  const active = tabs.find((t) => t.segment === current);

  return (
    <Tabs value={active ? active.segment : false} aria-label={ariaLabel}>
      {tabs.map((t) => (
        <Tab
          key={t.segment}
          value={t.segment}
          icon={t.icon}
          iconPosition="start"
          label={t.label}
          component={Link}
          to={`${basePath}/${t.segment}`}
        />
      ))}
    </Tabs>
  );
}
