"use client";

import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  Form,
  Input,
  Label,
  Row,
  Spinner,
  Table,
} from "reactstrap";
import { useTranslation } from "react-i18next";
import { CmsAdminUser, CmsAdminUserRole, cmsApi } from "@/helpers/cmsApi";

type UserDraft = {
  name: string;
  role: CmsAdminUserRole;
  isActive: boolean;
};

function getErrorMessage(
  error: unknown,
  translate: (key: string) => string
): string {
  const value = error as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const message = value?.response?.data?.message ?? value?.message;
  if (Array.isArray(message)) {
    return message.map(item => translate(item)).join(", ");
  }
  return translate(
    message ?? "Unable to complete the user-management request."
  );
}

function toDraft(user: CmsAdminUser): UserDraft {
  return { name: user.name, role: user.role, isActive: user.isActive };
}

export default function CmsUsersPage() {
  const { t, i18n } = useTranslation();
  const [users, setUsers] = useState<CmsAdminUser[]>([]);
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({});
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await cmsApi.users({
        page,
        limit: 20,
        ...(search ? { search } : {}),
      });
      setUsers(result.data);
      setTotal(result.meta.total);
      setTotalPages(result.meta.totalPages);
      setDrafts(
        Object.fromEntries(result.data.map(user => [user.id, toDraft(user)]))
      );
    } catch (cause) {
      setError(getErrorMessage(cause, t));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasChanges = useMemo(
    () =>
      users.some(user => {
        const draft = drafts[user.id];
        return (
          draft &&
          (draft.name !== user.name ||
            draft.role !== user.role ||
            draft.isActive !== user.isActive)
        );
      }),
    [drafts, users]
  );

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(query.trim());
  };

  const changeDraft = (userId: string, patch: Partial<UserDraft>) => {
    setDrafts(current => ({
      ...current,
      [userId]: { ...current[userId], ...patch },
    }));
  };

  const saveUser = async (user: CmsAdminUser) => {
    const draft = drafts[user.id];
    if (!draft) return;

    if (user.isActive && !draft.isActive) {
      const confirmed = window.confirm(t("Deactivate this user account?"));
      if (!confirmed) return;
    }
    if (user.role === "ADMIN" && draft.role !== "ADMIN") {
      const confirmed = window.confirm(t("Change this administrator's role?"));
      if (!confirmed) return;
    }

    setSavingId(user.id);
    setError("");
    setNotice("");
    try {
      await cmsApi.updateUser(user.id, {
        name: draft.name.trim(),
        role: draft.role,
        isActive: draft.isActive,
      });
      setNotice(t("User updated successfully"));
      await load();
    } catch (cause) {
      setError(getErrorMessage(cause, t));
    } finally {
      setSavingId("");
    }
  };

  const resetDraft = (user: CmsAdminUser) => {
    setDrafts(current => ({ ...current, [user.id]: toDraft(user) }));
  };

  const roleLabel = (role: CmsAdminUserRole) => {
    if (role === "ADMIN") return t("Administrator");
    if (role === "MANAGER") return t("Manager");
    return t("User");
  };

  return (
    <div
      className="page-content"
      dir={["fa", "ar"].includes(i18n.language.split("-")[0]) ? "rtl" : "ltr"}
    >
      <Container fluid>
        <Row className="align-items-center mb-4">
          <Col>
            <h4 className="mb-1">{t("User management")}</h4>
            <p className="text-muted mb-0">
              {t(
                "Manage installation users, role assignments and account activation"
              )}
            </p>
          </Col>
          <Col xs="auto">
            <Link href="/apps-cms/permissions" className="btn btn-light">
              <i className="ri-shield-user-line me-1" />
              {t("Role permissions")}
            </Link>
          </Col>
        </Row>

        {error && (
          <Alert color="danger" toggle={() => setError("")}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert color="success" toggle={() => setNotice("")}>
            {notice}
          </Alert>
        )}

        <Card>
          <CardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h5 className="card-title mb-1">{t("Installation users")}</h5>
              <small className="text-muted">
                {t("User listing and updates are restricted to administrators")}
              </small>
            </div>
            <Button
              color="light"
              onClick={() => void load()}
              disabled={loading || Boolean(savingId)}
            >
              <i className="ri-refresh-line me-1" />
              {t("Refresh")}
            </Button>
          </CardHeader>
          <CardBody>
            <Form onSubmit={submitSearch} className="mb-3">
              <Row className="g-2 align-items-end">
                <Col md={6} lg={5}>
                  <Label htmlFor="cms-user-search">
                    {t("Search by name or email")}
                  </Label>
                  <Input
                    id="cms-user-search"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={t("Name or email")}
                  />
                </Col>
                <Col xs="auto">
                  <Button color="primary" type="submit" disabled={loading}>
                    <i className="ri-search-line me-1" />
                    {t("Search")}
                  </Button>
                </Col>
                <Col xs="auto">
                  <Button
                    color="light"
                    type="button"
                    disabled={!search && !query}
                    onClick={() => {
                      setQuery("");
                      setSearch("");
                      setPage(1);
                    }}
                  >
                    {t("Clear")}
                  </Button>
                </Col>
              </Row>
            </Form>

            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <span className="text-muted small">
                {t("Total users")}:{" "}
                <strong>{total.toLocaleString(i18n.language)}</strong>
              </span>
              <span className="text-muted small">
                {t(
                  "Only ADMIN, MANAGER and USER roles are supported by the current backend"
                )}
              </span>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <Spinner />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center text-muted py-5">
                <i className="ri-user-search-line fs-2 d-block mb-2" />
                {t("No users found")}
              </div>
            ) : (
              <div className="table-responsive">
                <Table hover responsive className="align-middle">
                  <thead>
                    <tr>
                      <th>{t("User")}</th>
                      <th>{t("Role")}</th>
                      <th>{t("Account status")}</th>
                      <th>{t("Created")}</th>
                      <th className="text-end">{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => {
                      const draft = drafts[user.id] ?? toDraft(user);
                      const dirty =
                        draft.name !== user.name ||
                        draft.role !== user.role ||
                        draft.isActive !== user.isActive;
                      const busy = savingId === user.id;

                      return (
                        <tr key={user.id}>
                          <td style={{ minWidth: 220 }}>
                            <Input
                              aria-label={t("Name")}
                              value={draft.name}
                              onChange={event =>
                                changeDraft(user.id, {
                                  name: event.target.value,
                                })
                              }
                              invalid={draft.name.trim().length < 2}
                            />
                            <small className="text-muted d-block mt-1">
                              {user.email}
                            </small>
                          </td>
                          <td style={{ minWidth: 150 }}>
                            <Input
                              type="select"
                              aria-label={t("Role")}
                              value={draft.role}
                              onChange={event =>
                                changeDraft(user.id, {
                                  role: event.target.value as CmsAdminUserRole,
                                })
                              }
                            >
                              <option value="ADMIN">
                                {roleLabel("ADMIN")}
                              </option>
                              <option value="MANAGER">
                                {roleLabel("MANAGER")}
                              </option>
                              <option value="USER">{roleLabel("USER")}</option>
                            </Input>
                          </td>
                          <td style={{ minWidth: 145 }}>
                            <div className="d-flex align-items-center gap-2">
                              <Input
                                type="checkbox"
                                checked={draft.isActive}
                                onChange={event =>
                                  changeDraft(user.id, {
                                    isActive: event.target.checked,
                                  })
                                }
                                aria-label={t("Account active")}
                              />
                              <Badge
                                color={draft.isActive ? "success" : "secondary"}
                              >
                                {draft.isActive ? t("Active") : t("Inactive")}
                              </Badge>
                            </div>
                          </td>
                          <td
                            className="text-muted small"
                            style={{ minWidth: 150 }}
                          >
                            {new Date(user.createdAt).toLocaleDateString(
                              i18n.language
                            )}
                          </td>
                          <td className="text-end" style={{ minWidth: 150 }}>
                            <div className="d-flex justify-content-end gap-1">
                              <Button
                                color="primary"
                                size="sm"
                                disabled={
                                  !dirty || busy || draft.name.trim().length < 2
                                }
                                onClick={() => void saveUser(user)}
                              >
                                {busy ? <Spinner size="sm" /> : t("Save")}
                              </Button>
                              <Button
                                color="light"
                                size="sm"
                                disabled={!dirty || busy}
                                onClick={() => resetDraft(user)}
                              >
                                {t("Reset")}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}

            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-3">
              <span className="text-muted small">
                {t("Page")} {page} {t("of")} {Math.max(1, totalPages)}
              </span>
              <div className="d-flex gap-2">
                <Button
                  color="light"
                  disabled={loading || page <= 1}
                  onClick={() => setPage(value => Math.max(1, value - 1))}
                >
                  {t("Previous")}
                </Button>
                <Button
                  color="light"
                  disabled={loading || page >= totalPages}
                  onClick={() => setPage(value => value + 1)}
                >
                  {t("Next")}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        <Alert color="info" className="mt-3">
          {t(
            "User invitation, password recovery, email verification and MFA are not available in this release."
          )}
        </Alert>
        {hasChanges && (
          <Alert color="warning" className="mt-3">
            {t(
              "You have unsaved user changes. Save each edited row before leaving this page."
            )}
          </Alert>
        )}
      </Container>
    </div>
  );
}
