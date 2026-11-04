"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import {
  UncontrolledDropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from "reactstrap";
import { useTranslation } from "react-i18next";
import { logoutUser } from "@slices/auth/login/thunk";
import type { AppDispatch } from "@slices/store";

const ProfileDropdown = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const authUser = useSelector((state: any) => state.Login?.user);
  const [loggingOut, setLoggingOut] = useState(false);

  const userName =
    (typeof authUser?.name === "string" && authUser.name.trim()) ||
    (typeof authUser?.email === "string" && authUser.email.trim()) ||
    t("Administrator");
  const canManageUsers = ["ADMIN", "SUPER_ADMIN"].includes(authUser?.role);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const succeeded = await dispatch(logoutUser());
      if (succeeded) router.replace("/auth/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <UncontrolledDropdown nav inNavbar className="ms-sm-3 header-item topbar-user">
      <DropdownToggle tag="button" type="button" className="btn">
        <span className="d-flex align-items-center">
          <span
            className="rounded-circle header-profile-user bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center fw-semibold"
            style={{ width: 40, height: 40 }}
            aria-hidden="true"
          >
            {userName.slice(0, 1).toUpperCase()}
          </span>
          <span className="text-start ms-xl-2">
            <span className="d-none d-xl-inline-block ms-1 fw-medium user-name-text">
              {userName}
            </span>
            <span className="d-none d-xl-block ms-1 fs-12 text-muted user-name-sub-text">
              {t(authUser?.role ?? "User")}
            </span>
          </span>
        </span>
      </DropdownToggle>

      <DropdownMenu className="dropdown-menu-end">
        <h6 className="dropdown-header">{t("Welcome")}, {userName}</h6>
        <DropdownItem className="p-0">
          <Link href="/apps-cms" className="dropdown-item">
            <i className="mdi mdi-view-dashboard-outline text-muted fs-16 align-middle me-1" />
            <span className="align-middle">{t("CMS Overview")}</span>
          </Link>
        </DropdownItem>
        {canManageUsers && (
          <DropdownItem className="p-0">
            <Link href="/apps-cms/users" className="dropdown-item">
              <i className="mdi mdi-account-cog-outline text-muted fs-16 align-middle me-1" />
              <span className="align-middle">{t("User management")}</span>
            </Link>
          </DropdownItem>
        )}
        <div className="dropdown-divider" />
        <DropdownItem tag="div" className="p-0">
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="dropdown-item"
          >
            <i className="mdi mdi-logout text-muted fs-16 align-middle me-1" />
            <span className="align-middle">{loggingOut ? t("Signing out") : t("Logout")}</span>
          </button>
        </DropdownItem>
      </DropdownMenu>
    </UncontrolledDropdown>
  );
};

export default ProfileDropdown;
