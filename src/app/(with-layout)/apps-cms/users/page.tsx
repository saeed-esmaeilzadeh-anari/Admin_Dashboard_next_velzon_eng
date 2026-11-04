"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Col, Container, Input, Label, Row, Spinner, Table } from "reactstrap";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsRole, CmsUser } from "@/helpers/cmsApi";

type UserDraft = { name: string; role: CmsRole; isActive: boolean };

const editableRoles: CmsRole[] = [
  "MANAGER",
  "CONTENT_MANAGER",
  "EDITOR",
  "AUTHOR",
  "REVIEWER",
  "MEDIA_MANAGER",
  "ANALYST",
  "READ_ONLY",
  "USER",
];

function getError(error: unknown): string {
  const value = error as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const message = value?.response?.data?.message ?? value?.message;
  return Array.isArray(message)
    ? message.join(", ")
    : message ?? "Unable to complete the user operation.";
}

export default function CmsUsersPage() {
  const { t, i18n } = useTranslation();
  const authUser = useSelector((state: any) => state.Login?.user);
  const isSuperAdmin = authUser?.role === "SUPER_ADMIN";
  const roles = useMemo(
    () => (isSuperAdmin ? ["SUPER_ADMIN" as CmsRole, ...editableRoles] : editableRoles),
    [isSuperAdmin]
  );

  const [users, setUsers] = useState<CmsUser[]>([]);
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({});
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await cmsApi.users({ page, limit: 20, search });
      setUsers(result.data);
      setTotal(result.meta.total);
      setTotalPages(Math.max(1, result.meta.totalPages));
      setDrafts(
        Object.fromEntries(
          result.data.map(user => [
            user.id,
            { name: user.name, role: user.role, isActive: user.isActive },
          ])
        )
      );
    } catch (cause) {
      setError(getError(cause));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const applySearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const updateDraft = (id: string, patch: Partial<UserDraft>) => {
    setDrafts(current => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  };

  const save = async (user: CmsUser) => {
    const draft = drafts[user.id];
    if (!draft) return;

    const patch: Partial<Pick<CmsUser, "name" | "role" | "isActive">> = {};
    if (draft.name.trim() !== user.name) patch.name = draft.name.trim();
    if (draft.role !== user.role) patch.role = draft.role;
    if (draft.isActive !== user.isActive) patch.isActive = draft.isActive;
    if (!Object.keys(patch).length) return;

    setSavingId(user.id);
    setError("");
    setNotice("");
    try {
      await cmsApi.updateUser(user.id, patch);
      setNotice(t("User updated successfully"));
      await load();
    } catch (cause) {
      setError(getError(cause));
    } finally {
      setSavingId("");
    }
  };

  const pageDirection =
    ["fa", "ar"].includes(i18n.language.toLowerCase().split("-")[0])
      ? "rtl"
      : "ltr";

  return (
    <div className="page-content" dir={pageDirection}>
      <Container fluid>
        <Row className="align-items-center mb-4">
          <Col>
            <h4 className="mb-1">{t("User management")}</h4>
            <p className="text-muted mb-0">
              {t("Review organization accounts, assign CMS roles and manage account access.")}
            </p>
          </Col>
          <Col xs="auto">
            <Link href="/apps-cms" className="btn btn-light">
              {t("Back to CMS")}
            </Link>
          </Col>
        </Row>

        {error && <Alert color="danger" toggle={() => setError("")}>{error}</Alert>}
        {notice && <Alert color="success" toggle={() => setNotice("")}>{notice}</Alert>}

        <Card>
          <CardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h5 className="card-title mb-1">{t("Organization users")}</h5>
              <small className="text-muted">
                {t("Total users")}: {new Intl.NumberFormat(i18n.language).format(total)}
              </small>
            </div>
            <Button color="light" onClick={() => void load()} disabled={loading}>
              <i className="ri-refresh-line me-1" />{t("Refresh")}
            </Button>
          </CardHeader>
          <CardBody>
            <form onSubmit={applySearch} className="d-flex flex-wrap gap-2 mb-3">
              <div className="flex-grow-1" style={{ minWidth: 220 }}>
                <Label htmlFor="cms-user-search" className="visually-hidden">
                  {t("Search name or email")}
                </Label>
                <Input
                  id="cms-user-search"
                  value={searchInput}
                  onChange={event => setSearchInput(event.target.value)}
                  placeholder={t("Search name or email")}
                />
              </div>
              <Button color="primary" type="submit">{t("Search")}</Button>
              <Button
                color="light"
                type="button"
                onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}
              >
                {t("Clear")}
              </Button>
            </form>

            {loading ? (
              <div className="text-center py-5"><Spinner /> <span className="ms-2">{t("Loading")}</span></div>
            ) : users.length === 0 ? (
              <Alert color="light" className="mb-0">{t("No users found")}</Alert>
            ) : (
              <div className="table-responsive">
                <Table hover responsive className="align-middle">
                  <thead>
                    <tr>
                      <th>{t("User")}</th>
                      <th>{t("Role")}</th>
                      <th>{t("Account status")}</th>
                      <th>{t("Created")}</th>
                      <th>{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => {
                      const draft = drafts[user.id] ?? {
                        name: user.name,
                        role: user.role,
                        isActive: user.isActive,
                      };
                      const dirty =
                        draft.name.trim() !== user.name ||
                        draft.role !== user.role ||
                        draft.isActive !== user.isActive;
                      const isSelf = user.id === authUser?.id;
                      const isProtectedAdmin =
                        user.role === "ADMIN" || user.role === "SUPER_ADMIN";
                      const cannotEdit =
                        (isSelf && isProtectedAdmin) ||
                        (!isSuperAdmin && user.role === "SUPER_ADMIN");
                      return (
                        <tr key={user.id}>
                          <td style={{ minWidth: 220 }}>
                            <Input
                              value={draft.name}
                              disabled={cannotEdit || savingId === user.id}
                              onChange={event => updateDraft(user.id, { name: event.target.value })}
                              aria-label={t("Name")}
                            />
                            <small className="text-muted">{user.email}</small>
                          </td>
                          <td style={{ minWidth: 180 }}>
                            <Input
                              type="select"
                              value={draft.role}
                              disabled={cannotEdit || savingId === user.id}
                              onChange={event => updateDraft(user.id, { role: event.target.value as CmsRole })}
                              aria-label={t("Role")}
                            >
                              {roles.map(role => (
                                <option key={role} value={role}>{t(role)}</option>
                              ))}
                            </Input>
                          </td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <Input
                                type="checkbox"
                                checked={draft.isActive}
                                disabled={cannotEdit || savingId === user.id}
                                onChange={event => updateDraft(user.id, { isActive: event.target.checked })}
                                aria-label={t("Account active")}
                              />
                              <Badge color={draft.isActive ? "success" : "secondary"}>
                                {t(draft.isActive ? "Active" : "Inactive")}
                              </Badge>
                            </div>
                          </td>
                          <td style={{ minWidth: 140 }}>
                            <small>{new Date(user.createdAt).toLocaleDateString(i18n.language)}</small>
                          </td>
                          <td>
                            <Button
                              color="primary"
                              size="sm"
                              disabled={!dirty || cannotEdit || savingId === user.id || draft.name.trim().length < 2}
                              onClick={() => void save(user)}
                            >
                              {savingId === user.id ? <Spinner size="sm" /> : t("Save")}
                            </Button>
                            {cannotEdit && (
                              <small className="d-block text-muted mt-1">
                                {t("Protected administrator account")}
                              </small>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}

            <div className="d-flex align-items-center justify-content-between mt-3">
              <small className="text-muted">
                {t("Page")} {page} / {totalPages}
              </small>
              <div className="d-flex gap-2">
                <Button color="light" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>
                  {t("Previous")}
                </Button>
                <Button color="light" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage(value => value + 1)}>
                  {t("Next")}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        <Alert color="info" className="mt-3">
          {t("This release supports account listing, role changes and activation control. Invitations, password recovery, email verification and session revocation are not yet implemented.")}
        </Alert>
      </Container>
    </div>
  );
}
