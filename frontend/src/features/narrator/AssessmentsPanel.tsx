import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { getNarrator } from "@/api/corpus";
import { createAssessment, listAssessments } from "@/api/narratorDossier";
import { invalidate } from "@/api/invalidate";
import { qk } from "@/api/queryKeys";
import { ASSESSMENT_CATEGORIES } from "@/api/schemas/narratorDossier";
import { BidiText } from "@/components/BidiText";
import { Button } from "@/components/Button";
import dialog from "@/components/Dialog.module.css";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { MutationNotice } from "@/components/MutationNotice";
import { RefreshNotice } from "@/components/RefreshNotice";
import { StateBoundary } from "@/components/StateBoundary";
import { viewStateOf } from "@/components/viewState";
import { narratorCode } from "@/features/comparison/comparisonModel";
import { NarratorPicker } from "@/features/comparison/NarratorPicker";
import { groupByTeacher, isAssessmentCategory } from "./narratorModel";
import styles from "./Narrator.module.css";

/**
 * What critics said about this narrator's reports from one particular teacher. Only recorded and listed here; the
 * comparison workspace and the isnād graph do not use these yet (the design says they should, only on the chains through
 * that teacher), so the screen does not claim they do (request file C-37).
 */
export function AssessmentsPanel({
  projectId,
  narratorId,
  canEdit,
}: {
  projectId: number;
  narratorId: number;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const list = useQuery({
    queryKey: qk.project(projectId).narrator(narratorId).assessments,
    queryFn: ({ signal }) => listAssessments(projectId, narratorId, signal),
  });
  const groups = groupByTeacher(list.data ?? []);
  const names = useQueries({
    queries: groups.map((g) => ({
      queryKey: qk.corpus.narrator(g.teacherId),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getNarrator(g.teacherId, signal),
      retry: false,
    })),
  });
  const view = list.data ? "normal" : viewStateOf(list);

  return (
    <section className={styles.section} aria-labelledby="assessments-h">
      <div className={styles.head}>
        <h2 id="assessments-h">{t("narrator.assessments.title")}</h2>
        {canEdit ? (
          <Button onClick={() => setAdding(true)}>
            {t("narrator.assessments.add")}
          </Button>
        ) : null}
      </div>
      <p className={styles.meta}>{t("narrator.assessments.note")}</p>
      <StateBoundary
        state={view}
        errorValue={list.error}
        onRetry={() => void list.refetch()}
      >
        <RefreshNotice query={list} what={t("narrator.assessments.title")} />
        {groups.length === 0 ? (
          <p className={styles.empty}>{t("narrator.assessments.empty")}</p>
        ) : (
          groups.map((g, gi) => {
            const name = names[gi]?.data?.name;
            return (
              <div key={g.teacherId}>
                <h3>
                  {t("narrator.assessments.from")}{" "}
                  {name ? <BidiText>{name}</BidiText> : null}{" "}
                  <span className="mono">{narratorCode(g.teacherId)}</span>
                </h3>
                <ul
                  className={styles.members}
                  aria-label={t("narrator.assessments.fromAria", {
                    teacher: name ?? narratorCode(g.teacherId),
                  })}
                >
                  {g.items.map((a) => (
                    <li key={a.id} className={styles.member}>
                      <div>
                        <span className={styles.rel}>
                          {isAssessmentCategory(a.assessment_category)
                            ? t(`narrator.categories.${a.assessment_category}`)
                            : a.assessment_category}
                        </span>
                        <p>
                          <BidiText>{a.qawl_text}</BidiText>
                        </p>
                        <p className={styles.meta}>
                          {a.critic_name ? (
                            <BidiText>{a.critic_name}</BidiText>
                          ) : (
                            t("narrator.assessments.noCritic")
                          )}
                          {a.creator?.display_name
                            ? ` · ${t("narrator.assessments.recordedBy", { name: a.creator.display_name })}`
                            : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </StateBoundary>
      {adding ? (
        <AssessmentDialog
          projectId={projectId}
          narratorId={narratorId}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </section>
  );
}

function AssessmentDialog({
  projectId,
  narratorId,
  onClose,
}: {
  projectId: number;
  narratorId: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [teacher, setTeacher] = useState<{ id: number; name: string } | null>(
    null,
  );
  const schema = z.object({
    category: z.enum(ASSESSMENT_CATEGORIES),
    critic: z.string().max(255),
    text: z.string().trim().min(1, t("narrator.assessments.textRequired")),
  });
  type Values = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { category: "sound", critic: "", text: "" },
  });
  const [missing, setMissing] = useState(false);
  const save = useMutation({
    mutationFn: (v: Values) =>
      createAssessment(projectId, {
        narrator_id: narratorId,
        teacher_id: teacher!.id,
        assessment_category: v.category,
        critic_name: v.critic.trim(),
        qawl_text: v.text.trim(),
      }),
    onSuccess: async () => {
      await invalidate.narratorDossierChanged(qc, projectId, narratorId);
      onClose();
    },
  });
  return (
    <Modal title={t("narrator.assessments.addTitle")} onClose={onClose} wide>
      <p>
        {t("narrator.assessments.teacher")}:{" "}
        {teacher ? (
          <>
            <BidiText>{teacher.name}</BidiText>{" "}
            <span className="mono">{narratorCode(teacher.id)}</span>
          </>
        ) : (
          <span className={missing ? styles.meta : undefined}>
            {missing
              ? t("narrator.assessments.teacherRequired")
              : t("narrator.assessments.teacherNone")}
          </span>
        )}
      </p>
      <NarratorPicker
        exclude={[narratorId]}
        onPick={(n) => {
          setTeacher({ id: n.id, name: n.name });
          setMissing(false);
        }}
      />
      <form
        noValidate
        onSubmit={(e) => {
          setMissing(!teacher);
          void handleSubmit((v) => (teacher ? save.mutate(v) : undefined))(e);
        }}
      >
        <Field
          label={t("narrator.assessments.category")}
          requirement="required"
        >
          <select {...register("category")}>
            {ASSESSMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`narrator.categories.${c}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("narrator.assessments.critic")} requirement="optional">
          <input dir="auto" {...register("critic")} />
        </Field>
        <Field
          label={t("narrator.assessments.text")}
          requirement="required"
          error={errors.text?.message}
          hint={t("narrator.assessments.textHint")}
        >
          <textarea
            rows={3}
            dir="auto"
            aria-invalid={errors.text ? true : undefined}
            {...register("text")}
          />
        </Field>
        <MutationNotice
          error={save.error}
          title={t("narrator.assessments.failed")}
        />
        <div className={dialog.actions}>
          <Button onClick={onClose} disabled={save.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {t("narrator.assessments.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
