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
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { humanizeHttpError } from "@api/http";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import { useUpdatePromotionRequestJobBand } from "../api/usePromotionRequests";
import type { PromotionRequestFull } from "../api/types";

// Source's own job-band picker (submittedRequests.tsx) hardcodes 1–13; kept
// as-is here rather than sourcing a real job-band list, since that's what
// the running app actually offers.
const JOB_BANDS = Array.from({ length: 13 }, (_, i) => i + 1);

// Ports submittedRequests.tsx's own "Update Application Job Band" dialog —
// Active Promotion Requests tab only.
export default function EditJobBandDialog({
  request,
  onClose,
}: {
  request: PromotionRequestFull | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(request)} onClose={onClose} maxWidth="sm" fullWidth>
      {request && (
        // Keyed on the request id so the picker's own state (and the
        // "nothing to update"/"pick a different band" warning) resets
        // fresh whenever a different row opens this dialog, rather than
        // needing an effect to re-seed it — React's own recommended
        // pattern for "reset state when a prop changes".
        <EditJobBandDialogContent key={request.id} request={request} onClose={onClose} />
      )}
    </Dialog>
  );
}

function EditJobBandDialogContent({
  request,
  onClose,
}: {
  request: PromotionRequestFull;
  onClose: () => void;
}) {
  const [promotingJobBand, setPromotingJobBand] = useState<number | null>(request.nextJobBand ?? null);
  const [warning, setWarning] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmationContent | null>(null);
  const update = useUpdatePromotionRequestJobBand();

  const handleSave = () => {
    if (promotingJobBand == null) {
      setWarning("Nothing to update");
      return;
    }
    if (promotingJobBand === request.nextJobBand) {
      setWarning("Please select a valid job band other than the current promotion job band.");
      return;
    }
    setConfirm({
      title: "Do you want to update this promotion request?",
      text: "The recommended job band for this request will change.",
      confirmLabel: "Yes",
      confirmAction: () => {
        // Stays open (rather than closing immediately) until the mutation
        // actually resolves — closing right away would unmount this content
        // before a failed PATCH's error had anywhere to render, silently
        // telling the user it worked when it didn't.
        update.mutate({ id: request.id, promotingJobBand }, { onSuccess: onClose });
      },
    });
  };

  return (
    <>
      <ConfirmationDialog content={confirm} onClose={() => setConfirm(null)} />
      <DialogTitle>Update Application Job Band</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={6}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>Current Job Band</Typography>
            <TextField size="small" disabled fullWidth value={request.currentJobBand} />
          </Grid>
          <Grid size={6}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>Recommended Job Band *</Typography>
            <Autocomplete
              size="small"
              options={JOB_BANDS.filter((band) => band > request.currentJobBand)}
              getOptionLabel={(option) => String(option)}
              value={promotingJobBand}
              onChange={(_e, value) => setPromotingJobBand(value)}
              renderInput={(params) => <TextField {...params} />}
            />
          </Grid>
        </Grid>
        {warning && <Typography sx={{ fontSize: 12.5, color: "warning.main", mt: 1.5 }}>{warning}</Typography>}
        {update.isError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {humanizeHttpError(update.error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={update.isPending}>
          Save
        </Button>
      </DialogActions>
    </>
  );
}
