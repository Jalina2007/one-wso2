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

import { useState } from "react";
import { Box, Button, Dialog, DialogContent, TextField, Typography } from "@wso2/oxygen-ui";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { Campaign } from "../api/amplifyTypes";
import { useArchiveCampaign } from "../api/useAmplifyMutations";
import { describeAmplifyError } from "../util/amplifyError";

const CONFIRM_WORD = "delete";

/**
 * Delete post confirmation, opened from Update post. The person types "delete" (any case) and clicks Go.
 */
export default function DeletePostDialog({
  campaign,
  onCancel,
  onDeleted,
}: {
  campaign: Campaign;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const archive = useArchiveCampaign();
  const { showError, showSuccess } = useNotifications();
  const [typed, setTyped] = useState("");
  const busy = archive.isPending;
  const matches = typed.trim().toLowerCase() === CONFIRM_WORD;

  const go = () => {
    if (!matches || busy) return;
    archive.mutate(
      { id: campaign.id },
      {
        onSuccess: () => {
          showSuccess("Post deleted");
          onDeleted();
        },
        onError: (err) => showError(describeAmplifyError(err)),
      },
    );
  };

  return (
    <Dialog
      open
      onClose={busy ? undefined : onCancel}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { ...dialogPaperSx, borderColor: "error.main" } } }}
      aria-labelledby="amplify-delete-post-title"
    >
      <DialogContent>
        <Typography id="amplify-delete-post-title" component="h2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Please confirm delete of: {campaign.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Type delete and click the go button
        </Typography>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
          sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
        >
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder={CONFIRM_WORD}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={busy}
            slotProps={{ htmlInput: { "aria-label": "Type delete to confirm", autoComplete: "off" } }}
          />
          <Button type="submit" variant="contained" color="error" disabled={!matches || busy}>
            {busy ? "Deleting…" : "Go"}
          </Button>
        </Box>
        <Box sx={{ mt: 2 }}>
          <Button onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
