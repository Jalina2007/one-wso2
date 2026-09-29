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
  Box,
  Button,
  Chip,
  Grid,
  Popover,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import type { PromotionRecommendation } from "../api/types";
import { useDeclineRecommendation } from "../api/useLeadRecommendations";

// Ports promotion-app's own component/recommendation/recommendationLine.tsx
// — one dashed-border row per pending (REQUESTED) recommendation, with
// "Start" (opens the edit form, RecommendationEditForm) and "Decline"
// (a reason popover, submitted immediately — matching source, no separate
// confirmation dialog).
export default function RecommendationCard({
  recommendation,
  onStart,
}: {
  recommendation: PromotionRecommendation;
  onStart: () => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [comment, setComment] = useState("");
  const decline = useDeclineRecommendation();

  const handleDecline = () => {
    decline.mutate(
      { id: recommendation.recommendationID, comment },
      { onSuccess: () => setAnchorEl(null) },
    );
  };

  return (
    <Box
      sx={{
        display: "flex",
        border: 1,
        borderStyle: "dashed",
        borderColor: "divider",
        borderRadius: 1,
        p: 2,
        mb: 1.25,
      }}
    >
      <Grid container spacing={2} sx={{ width: "100%", alignItems: "center" }}>
        <Grid size={4} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{recommendation.employeeName}</Typography>
          {recommendation.promotionType === "TIME_BASED" && (
            <Chip label="Time Based" size="small" sx={{ bgcolor: "#36B37E", color: "white" }} />
          )}
        </Grid>
        <Grid size={2}>
          <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{recommendation.promotionCycle}</Typography>
        </Grid>
        <Grid size={4}>
          <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{recommendation.employeeEmail}</Typography>
        </Grid>
        <Grid size={2} sx={{ display: "flex", justifyContent: "flex-end" }}>
          {recommendation.recommendationStatus === "REQUESTED" && (
            <Stack direction="row" spacing={1.5}>
              <Button variant="contained" sx={{ bgcolor: "#172B4D", boxShadow: "none" }} onClick={onStart}>
                Start
              </Button>
              <Button
                variant="contained"
                sx={{ bgcolor: "#DE350B", boxShadow: "none" }}
                onClick={(e) => setAnchorEl(e.currentTarget)}
              >
                Decline
              </Button>
              <Popover
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: "top", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "center" }}
              >
                <Box sx={{ p: 2.5, width: 320 }}>
                  <TextField
                    fullWidth
                    label="Reason for decline"
                    multiline
                    minRows={3}
                    maxRows={6}
                    slotProps={{ htmlInput: { maxLength: 250 } }}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>
                    {comment.length}/250
                  </Typography>
                  <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1 }}>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setComment("");
                        setAnchorEl(null);
                      }}
                    >
                      Close
                    </Button>
                    <Button
                      color="success"
                      variant="contained"
                      disabled={comment === "" || decline.isPending}
                      onClick={handleDecline}
                    >
                      Decline
                    </Button>
                  </Box>
                </Box>
              </Popover>
            </Stack>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
