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

import { useEffect, useState } from "react";
import { emailSignatureTemplateUrl } from "@config/apiConfig";

// undefined while the file is loading; null when none is configured or it
// can't be used, which means "use the built-in layout".
export type SignatureTemplate = string | null | undefined;

async function loadTemplate(url: string, signal: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(url, { signal, cache: "no-cache" });
    if (!res.ok) return null;
    const text = await res.text();
    // A missing file can come back as the app's own index page with a 200.
    if (!text.trim() || /id=["']root["']/.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

export function useSignatureTemplate(): SignatureTemplate {
  const [template, setTemplate] = useState<SignatureTemplate>(emailSignatureTemplateUrl ? undefined : null);

  useEffect(() => {
    if (!emailSignatureTemplateUrl) return;
    const controller = new AbortController();
    void loadTemplate(emailSignatureTemplateUrl, controller.signal).then((text) => {
      if (!controller.signal.aborted) setTemplate(text);
    });
    return () => controller.abort();
  }, []);

  return template;
}
