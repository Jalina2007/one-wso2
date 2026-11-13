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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  DataGrid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Link,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, TrashIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { UmtBundleInfoChange, UmtFileOperation, UmtPullRequestAnalysisItem, UmtUpdateSummary } from "../../../api/umtUpdates";
import {
  isUmtPrAnalysisInFlight,
  isUmtPrAnalysisRunning,
  type UmtUpdateType,
} from "../../../api/umtTypes";
import { useUmtLifecycleTransition } from "../../../api/useUmtLifecycleTransition";
import { useUmtPullRequestAnalysis } from "../../../api/useUmtUpdateViewData";
import { umtLifecycleState } from "../../../lib/umtLifecycleState";
import {
  useUmtStartPullRequestAnalysis,
  useUmtUploadPullRequestAnalysisFile,
} from "../../../api/useUmtPrAnalysis";
import {
  bundleInfoApplies,
  GITHUB_PR_REGEX,
  groupFileOperationsByType,
  isPrAnalyzeDisabled,
  pluginsFileHasMatchingBundleInfo,
  prAnalysisStatusMessage,
  type UmtPendingManualUpload,
} from "../../../lib/umtPrAnalysis";
import {
  readPersistedBundleInfoChanges,
  readPersistedManualFiles,
  readPersistedPullRequests,
  writePersistedBundleInfoChanges,
  writePersistedManualFiles,
  writePersistedPullRequests,
} from "../../../lib/umtLocalState";
import { isFilesAnalysisPrAnalyzed } from "../../../lib/umtEditSteps";
import { UMT_ALL_ROWS_GRID_PROPS } from "../../../lib/umtGrid";
import { isNotFound } from "../../../lib/umtNotFound";
import { SectionError } from "../../umtViewSectionPrimitives";
import UmtAddManualFilesSection from "./UmtAddManualFilesSection";
import UmtPrAnalysisInputsSkeleton from "./UmtPrAnalysisInputsSkeleton";
import UmtPrAnalysisResults from "./UmtPrAnalysisResults";

const { DataGrid: DataGridComponent } = DataGrid;

export default function UmtPrAnalysisStep({
  id,
  update,
  onDirtyChange,
}: {
  id: string;
  update: UmtUpdateSummary;
  // Reports inputs changed since the last analysis, so the Files Analysis
  // Proceed can ask before promoting past them.
  onDirtyChange?: (isDirty: boolean) => void;
}) {
  const { showSuccess, showError } = useNotifications();
  const lifecycleState = umtLifecycleState(update.lifecycleState);
  const pullRequestAnalysis = useUmtPullRequestAnalysis(id, lifecycleState, { alwaysEnabled: true });
  const isDevelopment = lifecycleState === "Development";
  // Analyze in PRAnalyzed demotes to Development first: the backend only
  // accepts uploads and a new analysis there.
  const isPrAnalyzed = isFilesAnalysisPrAnalyzed(lifecycleState);
  // The backend moves the update to PRAnalyzed before it runs the product
  // analysis, so a run can still be going on there. useUmtUpdate polls the
  // update while it is.
  const isRunning = isUmtPrAnalysisRunning(update);
  const startAnalysis = useUmtStartPullRequestAnalysis(id);
  const upload = useUmtUploadPullRequestAnalysisFile(id);
  const transition = useUmtLifecycleTransition(id);
  const [isFilesWarningOpen, setIsFilesWarningOpen] = useState(false);

  // The type the last analysis was submitted with, as the backend recorded it.
  const submittedUpdateType: UmtUpdateType = update.isInstructionsOnly
    ? "instructionsOnlyUpdate"
    : update.isContainerizedUpdate
      ? "containerizedProductUpdate"
      : "generalUpdate";
  const [updateType, setUpdateType] = useState<UmtUpdateType>(submittedUpdateType);
  // The step stays mounted across lifecycle changes and may first render from a
  // cached update, so the radio follows the recorded type whenever it changes.
  const [seenSubmittedType, setSeenSubmittedType] = useState(submittedUpdateType);
  if (seenSubmittedType !== submittedUpdateType) {
    setSeenSubmittedType(submittedUpdateType);
    setUpdateType(submittedUpdateType);
  }
  // Drafts are persisted to localStorage scoped by update id, so rows from
  // one update's PR Analysis step never leak into another's.
  const [pullRequests, setPullRequests] = useState<UmtPullRequestAnalysisItem[]>(() =>
    readPersistedPullRequests(id),
  );
  const [manualFiles, setManualFiles] = useState<UmtFileOperation[]>(() => readPersistedManualFiles(id));
  const [bundlesInfoChanges, setBundlesInfoChanges] = useState<UmtBundleInfoChange[]>(() =>
    readPersistedBundleInfoChanges(id),
  );
  // Manual files added but not uploaded yet. Their contents only live in
  // memory until Analyze uploads them, so they are never persisted.
  const [pendingUploads, setPendingUploads] = useState<UmtPendingManualUpload[]>([]);
  const [hasNewInputs, setHasNewInputs] = useState(true);
  // Unlike hasNewInputs (true on mount so Analyze starts enabled), this is
  // set only by an edit made in this session — not by filling the inputs from
  // the saved analysis — so Proceed can ask before it drops changes the last
  // analysis never saw.
  const [hasUnanalyzedChanges, setHasUnanalyzedChanges] = useState(false);
  useEffect(() => {
    onDirtyChange?.(hasUnanalyzedChanges);
  }, [hasUnanalyzedChanges, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // On reaching PRAnalyzed, the inputs start from what the backend analyzed
  // rather than this browser's drafts, which may be stale or missing entirely.
  // Waits out a refetch and a run still going on in PRAnalyzed: until the run
  // ends and the refetch lands, the cached analysis can still be the previous
  // run's, and seeding happens only once.
  const analyzed = pullRequestAnalysis.data;
  const [seededForPrAnalyzed, setSeededForPrAnalyzed] = useState(false);
  if (isPrAnalyzed && analyzed && !pullRequestAnalysis.isFetching && !isRunning && !seededForPrAnalyzed) {
    setSeededForPrAnalyzed(true);
    setUpdateType(submittedUpdateType);
    setPullRequests(analyzed.pullRequests ?? []);
    setManualFiles((analyzed.additionalFileOperations ?? []).map(({ file, operation }) => ({ file, operation })));
    setBundlesInfoChanges(
      (analyzed.bundlesInfoChanges ?? []).map((row) => ({
        bundlesInfoPath: row.bundlesInfoPath,
        jarName: row.jarName,
        jarVersion: row.jarVersion,
        relativeJarPath: row.relativeJarPath,
        entryType: row.changeType,
      })),
    );
    setPendingUploads([]);
    setHasNewInputs(false);
  }
  // A 404 means no analysis is stored for this update, so there is nothing to
  // fill the inputs from and nothing a retry could load. The drafts are all
  // there is, so they stay, and Analyze runs from them. Like the seeding
  // above, it waits out a refetch: a 404 cached from Development, before the
  // analysis ran, says nothing about PRAnalyzed.
  const analysisNotFound =
    isPrAnalyzed && !analyzed && !pullRequestAnalysis.isFetching && !isRunning && isNotFound(pullRequestAnalysis.error);
  if (analysisNotFound && !seededForPrAnalyzed) {
    setSeededForPrAnalyzed(true);
    setHasNewInputs(true);
  }
  // Back in Development the inputs are open to a new analysis, so Analyze
  // can't stay locked by the PRAnalyzed seeding above.
  if (!isPrAnalyzed && seededForPrAnalyzed) {
    setSeededForPrAnalyzed(false);
    setHasNewInputs(true);
  }
  // Until the inputs have been filled from the analysis they would show this
  // browser's drafts as if they were it, and Analyze would re-run from them. So
  // they are replaced by a placeholder, or by an error with a retry if the
  // analysis can't be loaded.
  const awaitingAnalysis = isPrAnalyzed && !seededForPrAnalyzed;
  const analysisFailed = awaitingAnalysis && !analyzed && !isRunning && pullRequestAnalysis.isError;

  // Persisted from effects rather than the setters, so the values seeded
  // above reach the drafts too and survive the demote Analyze starts with.
  useEffect(() => {
    writePersistedPullRequests(id, pullRequests);
  }, [id, pullRequests]);
  useEffect(() => {
    const pendingRows = new Set(pendingUploads.map((pending) => pending.row));
    writePersistedManualFiles(id, manualFiles.filter((row) => !pendingRows.has(row)));
  }, [id, manualFiles, pendingUploads]);
  useEffect(() => {
    writePersistedBundleInfoChanges(id, bundlesInfoChanges);
  }, [id, bundlesInfoChanges]);

  // Spans Analyze's whole run (demote, uploads, submission).
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // How a run this page watched ended is announced once: the reason the
  // promotion or product analysis failed, or else in PRAnalyzed. paError comes
  // first, as a failed demote back to Development leaves the update in
  // PRAnalyzed with it. A failed PR analysis is left to the status message.
  const watchedRunRef = useRef(false);
  useEffect(() => {
    if (isRunning) {
      watchedRunRef.current = true;
      return;
    }
    if (!watchedRunRef.current) return;
    watchedRunRef.current = false;
    if (update.paError) showError(update.paError);
    else if (isPrAnalyzed) showSuccess(`Update ${id} advanced to PRAnalyzed.`);
  }, [isRunning, isPrAnalyzed, update.paError, id, showSuccess, showError]);

  const [isPrDialogOpen, setIsPrDialogOpen] = useState(false);
  const [prUrl, setPrUrl] = useState("");
  const [preferredVersion, setPreferredVersion] = useState("");
  const [prError, setPrError] = useState<string | undefined>();
  const [deletePr, setDeletePr] = useState<string | null>(null);
  const [missingBundleInfoFiles, setMissingBundleInfoFiles] = useState<UmtFileOperation[]>([]);

  const markDirty = () => {
    setHasNewInputs(true);
    setHasUnanalyzedChanges(true);
  };

  // Disable inputs from the moment Analyze is clicked (the mutation's own
  // isPending), not just once the server confirms QUEUED. No separate "awaiting confirmation" grace flag
  // is needed once the mutation resolves: the backend commits praStatus and
  // the pending promotion synchronously before the start-analysis POST even
  // returns (verified against the backend source), so the update refetch the
  // mutation fires on success is guaranteed to read them — isRunning picks
  // the run up immediately, no race to bridge.
  //
  // The running message also says why Analyze, which demotes a PRAnalyzed
  // update first, is off while the promotion is pending: the backend rejects
  // that demote until the product analysis is done.
  const isBusy = isRunning || startAnalysis.isPending || isAnalyzing;
  const runningMessage =
    isAnalyzing || startAnalysis.isPending
      ? "Starting analysis…"
      : isUmtPrAnalysisInFlight(update.praStatus)
        ? "Running PR analysis…"
        : isRunning
          ? "PR analysis completed. Running product analysis…"
          : undefined;

  if (!isDevelopment && !isPrAnalyzed) {
    return <Alert severity="info">PR Analysis can only be done in Development.</Alert>;
  }

  function addPullRequest() {
    const trimmed = prUrl.trim();
    if (!GITHUB_PR_REGEX.test(trimmed)) {
      setPrError("Invalid Pull Request URL");
      return;
    }
    if (pullRequests.some((row) => row.pr === trimmed)) {
      setPrError("This pull request has already been added.");
      return;
    }
    const normalizedVersion = preferredVersion.trim().toLowerCase() === "auto" ? "" : preferredVersion.trim();
    setPullRequests([...pullRequests, { pr: trimmed, preferredVersion: normalizedVersion }]);
    markDirty();
    setPrUrl("");
    setPreferredVersion("");
    setPrError(undefined);
    setIsPrDialogOpen(false);
  }

  function confirmDeletePr() {
    if (!deletePr) return;
    setPullRequests(pullRequests.filter((row) => row.pr !== deletePr));
    markDirty();
    setDeletePr(null);
  }

  // Blocks Analyze (with a "Missing Bundle Info Paths" dialog) when a
  // /plugins/ Added or Removed file has no corresponding bundle-info entry,
  // since validating only at add time would let a file added before its
  // bundle info (or one whose entry was later deleted) reach the backend
  // unguarded. Only General Update collects manual files/bundle info at all.
  function handleAnalyzeClick() {
    if (updateType === "generalUpdate") {
      const missing = manualFiles.filter(
        (file) =>
          bundleInfoApplies(file.file ?? "", file.operation) &&
          !pluginsFileHasMatchingBundleInfo(file.file ?? "", bundlesInfoChanges),
      );
      if (missing.length > 0) {
        setMissingBundleInfoFiles(missing);
        return;
      }
      // Warns before analyzing that the added files will be copied into all
      // applicable products once the analysis moves the update on. It asks
      // only when the update also modifies files, since the remedy it offers
      // is to move the added files into a separate update, and an update of
      // only added files has nothing left to separate from.
      //
      // Manually added files only, not PR-identified ones: the dialog's remedy
      // (remove them and make a separate update) only applies to files the
      // user added by hand.
      const { added, modified } = groupFileOperationsByType(manualFiles);
      if (added.length > 0 && modified.length > 0) {
        setIsFilesWarningOpen(true);
        return;
      }
    }
    void handleAnalyze();
  }

  function handleManualFilesChange(rows: UmtFileOperation[], uploads: UmtPendingManualUpload[] = []) {
    setManualFiles(rows);
    // A deleted row takes its pending upload with it.
    setPendingUploads((current) => [...current.filter((pending) => rows.includes(pending.row)), ...uploads]);
  }

  async function handleAnalyze() {
    setIsFilesWarningOpen(false);
    setIsAnalyzing(true);
    try {
      if (isPrAnalyzed) await transition.mutateAsync("Development");
      // Only General Update sends manual files, so only it uploads them.
      if (updateType === "generalUpdate") {
        for (const [index, pending] of pendingUploads.entries()) {
          try {
            await upload.mutateAsync({
              relativePath: pending.relativePath,
              sourceFilePath: pending.sourceFilePath,
              file: pending.file,
              // Store a real file at the path its row is analyzed under. A URL
              // source's placeholder blob isn't the file's content, so it must
              // not take that path.
              filePath: pending.file instanceof File ? (pending.row.file ?? undefined) : undefined,
            });
          } catch (error) {
            // The ones before it are already uploaded, and stay uploaded: the
            // rest are still pending, so Analyze again only sends those.
            showError(
              `Uploaded ${index} of ${pendingUploads.length} ${pendingUploads.length === 1 ? "file" : "files"} ` +
                `before "${pending.row.file}" failed. ${describeError(error)}`,
            );
            return;
          }
          setPendingUploads((current) => current.filter((item) => item !== pending));
        }
      }
      // Only General Update collects manual files/bundle info, and Instructions
      // Only collects neither — send empty arrays rather than whatever is left
      // over in state from a previously-selected update type.
      await startAnalysis.mutateAsync({
        updateId: id,
        pullRequests: updateType === "instructionsOnlyUpdate" ? [] : pullRequests,
        additionalFileOperations: updateType === "generalUpdate" ? manualFiles : [],
        bundlesInfoChanges: updateType === "generalUpdate" ? bundlesInfoChanges : [],
        isInstructionsOnly: updateType === "instructionsOnlyUpdate",
        isContainerizedUpdate: updateType === "containerizedProductUpdate",
      });
      setHasNewInputs(false);
      setHasUnanalyzedChanges(false);
      showSuccess("PR analysis started.");
    } catch (error) {
      showError(`Failed to start PR analysis. ${describeError(error)}`);
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Being in PRAnalyzed is what says the analysis completed. A failed
  // promotion or product analysis is shown for as long as the backend keeps
  // its reason, so a reload still says why the update didn't move on.
  const failedPromotion = update.paError || undefined;
  const statusMessage = failedPromotion
    ? { lines: [failedPromotion], tone: "error" as const }
    : prAnalysisStatusMessage(isPrAnalyzed ? "COMPLETED" : update.praStatus, update.praError);
  const statusColor =
    statusMessage.tone === "error" ? "error.main" : statusMessage.tone === "success" ? "success.main" : "text.primary";
  const analyzeDisabled = isPrAnalyzeDisabled({
    status: update.praStatus,
    // A failed promotion or product analysis can be run again as it is, like
    // a failed PR analysis.
    hasNewInputsSinceLastAnalysis: hasNewInputs || Boolean(failedPromotion),
    updateType,
    pullRequestCount: pullRequests.length,
    // Same guard as the submitted payload: manual files only count for
    // General Update, so leftover files from a prior type selection can't
    // make this look non-empty for a type that won't actually send them.
    manualFileCount: updateType === "generalUpdate" ? manualFiles.length : 0,
  });

  // An Instructions Only update has no inputs, so once its analysis has
  // completed there is nothing left to analyze: no Analyze button, until the
  // update type is changed or the update goes back to Development. A failed
  // product analysis keeps the button and its reason, so it can be run again.
  const isInstructionsOnlyAnalyzed =
    isPrAnalyzed &&
    updateType === "instructionsOnlyUpdate" &&
    (awaitingAnalysis || !hasNewInputs) &&
    !isBusy &&
    !failedPromotion;

  return (
    <Stack spacing={3}>
      <Box>
        {awaitingAnalysis ? (
          analysisFailed ? (
            <SectionError title="Pull Request Analysis" onRetry={() => void pullRequestAnalysis.refetch()} />
          ) : (
            <UmtPrAnalysisInputsSkeleton updateType={updateType} />
          )
        ) : (
          <>
            <Typography variant="h6">Update Type</Typography>
            <RadioGroup
              row
              value={updateType}
              onChange={(e) => {
                setUpdateType(e.target.value as UmtUpdateType);
                markDirty();
              }}
              sx={{ opacity: isBusy ? 0.5 : 1, pointerEvents: isBusy ? "none" : "auto" }}
            >
              <FormControlLabel value="generalUpdate" control={<Radio />} label="General Update" />
              <FormControlLabel value="instructionsOnlyUpdate" control={<Radio />} label="Instructions Only Update" />
              <FormControlLabel
                value="containerizedProductUpdate"
                control={<Radio />}
                label="Containerized Product Update"
              />
            </RadioGroup>
            <Divider sx={{ mt: 2 }} />

            {updateType !== "instructionsOnlyUpdate" && (
              <Box sx={{ opacity: isBusy ? 0.5 : 1, pointerEvents: isBusy ? "none" : "auto" }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 2 }}>
                  <Typography variant="h6">Pull Requests</Typography>
                  <IconButton aria-label="Add pull request" size="small" onClick={() => setIsPrDialogOpen(true)}>
                    <PlusIcon size={18} />
                  </IconButton>
                </Stack>
                {pullRequests.length > 0 ? (
                  <DataGridComponent
                    autoHeight
                    {...UMT_ALL_ROWS_GRID_PROPS}
                    columnHeaderHeight={40}
                    disableColumnMenu
                    disableRowSelectionOnClick
                    getRowHeight={() => "auto"}
                    getRowId={(row: UmtPullRequestAnalysisItem) => row.pr ?? ""}
                    hideFooter
                    rows={pullRequests}
                    sx={{ mt: 2 }}
                    columns={[
                      {
                        field: "pr",
                        headerName: "Pull Request",
                        flex: 3,
                        sortable: false,
                        renderCell: (params: { row: UmtPullRequestAnalysisItem }) => (
                          <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
                            {params.row.pr && (
                              <Link href={params.row.pr} target="_blank" rel="noopener noreferrer" underline="hover">
                                {params.row.pr}
                              </Link>
                            )}
                          </Stack>
                        ),
                      },
                      {
                        field: "preferredVersion",
                        headerName: "Preferred Version",
                        flex: 1,
                        sortable: false,
                        renderCell: (params: { row: UmtPullRequestAnalysisItem }) => (
                          <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
                            {params.row.preferredVersion}
                          </Stack>
                        ),
                      },
                      {
                        field: "delete",
                        headerName: "",
                        width: 52,
                        sortable: false,
                        renderCell: (params: { row: UmtPullRequestAnalysisItem }) => (
                          <Stack sx={{ justifyContent: "center", minHeight: "100%", width: "100%" }}>
                            <IconButton
                              aria-label="Delete pull request"
                              size="small"
                              onClick={() => setDeletePr(params.row.pr ?? null)}
                            >
                              <TrashIcon size={16} />
                            </IconButton>
                          </Stack>
                        ),
                      },
                    ]}
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Add a pull request to analyze.
                  </Typography>
                )}
              </Box>
            )}

            {updateType === "generalUpdate" && (
              <>
                <Divider sx={{ my: 2 }} />
                <UmtAddManualFilesSection
                  updateId={id}
                  disabled={isBusy}
                  files={manualFiles}
                  onFilesChange={handleManualFilesChange}
                  bundlesInfoChanges={bundlesInfoChanges}
                  onBundlesInfoChanged={setBundlesInfoChanges}
                  onDirty={markDirty}
                />
              </>
            )}
          </>
        )}

        {!isInstructionsOnlyAnalyzed && (
          <>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "flex-end", mt: 3 }}>
              {isBusy && <CircularProgress size={22} />}
              {(isBusy || updateType !== "instructionsOnlyUpdate" || Boolean(failedPromotion)) && (
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  {runningMessage ? (
                    <Typography variant="body2" color="text.primary">
                      {runningMessage}
                    </Typography>
                  ) : (
                    statusMessage.lines.map((line, index) => (
                      <Typography key={index} variant="body2" color={statusColor} sx={{ wordBreak: "break-word" }}>
                        {line}
                      </Typography>
                    ))
                  )}
                </Stack>
              )}
              <Button
                variant="contained"
                disabled={analyzeDisabled || isBusy || awaitingAnalysis}
                loading={isAnalyzing}
                onClick={handleAnalyzeClick}
              >
                Analyze
              </Button>
            </Stack>
            <Divider sx={{ mt: 3 }} />
          </>
        )}
      </Box>

      {/* Only once the product analysis has finished too, i.e. in PRAnalyzed. */}
      {isPrAnalyzed && !isRunning && !pullRequestAnalysis.isFetching && pullRequestAnalysis.data && (
        <UmtPrAnalysisResults result={pullRequestAnalysis.data} />
      )}
      {analysisNotFound && (
        <Alert severity="info">Pull Request Analysis has not been performed for this update yet.</Alert>
      )}

      <Dialog open={isPrDialogOpen} onClose={() => setIsPrDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Pull Request</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Pull Request URL"
              value={prUrl}
              onChange={(e) => {
                setPrUrl(e.target.value);
                setPrError(undefined);
              }}
              error={Boolean(prError)}
              helperText={prError}
            />
            <TextField
              fullWidth
              label="Preferred Version (Optional)"
              placeholder="Auto"
              value={preferredVersion}
              onChange={(e) => setPreferredVersion(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsPrDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!prUrl.trim()} onClick={addPullRequest}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deletePr)} onClose={() => setDeletePr(null)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this pull request?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletePr(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmDeletePr}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isFilesWarningOpen} onClose={() => setIsFilesWarningOpen(false)}>
        <DialogTitle>Added and Modified Files</DialogTitle>
        <DialogContent>
          <DialogContentText>
            There are modified and added files in this update.
            <br />
            UMT will copy the added files into all the applicable products in the next section.
            <br />
            If you want to exclude the added files going into applicable products, please remove the added files
            from this update and create a separate update with the added files.
            <br />
            Do you need to proceed without excluding the added files?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => void handleAnalyze()}>Yes Proceed</Button>
          <Button onClick={() => setIsFilesWarningOpen(false)}>No</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={missingBundleInfoFiles.length > 0} onClose={() => setMissingBundleInfoFiles([])}>
        <DialogTitle>Missing Bundle Info Paths</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }}>
            The following /plugins/ files need a corresponding Bundle Info Changes entry before this update can
            be analyzed:
          </DialogContentText>
          <Stack spacing={0.5}>
            {missingBundleInfoFiles.map((file, index) => (
              <Typography key={index} variant="body2" sx={{ fontFamily: "monospace" }}>
                {file.operation}: {file.file}
              </Typography>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setMissingBundleInfoFiles([])}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
