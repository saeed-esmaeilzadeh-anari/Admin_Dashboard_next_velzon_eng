"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useDispatch, useSelector } from "react-redux";
import { changeSidebarVisibility } from "@slices/thunks";
import LanguageDropdown from "@common/LanguageDropdown";
import ProfileDropdown from "@common/ProfileDropdown";
import LightDark from "@common/LightDark";
import type { AppDispatch } from "@slices/store";

const logoSm = "/images/logo-sm.png";
const logoDark = "/images/logo-dark.png";

const Header = ({ onChangeLayoutMode, layoutModeType, headerClass }: any) => {
  const dispatch = useDispatch<AppDispatch>();
  const sidebarVisibilitytype = useSelector(
    (state: any) => state.Layout.sidebarVisibilitytype
  );

  const toggleMenu = () => {
    const windowSize = document.documentElement.clientWidth;
    const hamburger = document.querySelector(".hamburger-icon") as HTMLElement | null;
    dispatch(changeSidebarVisibility("show"));

    if (windowSize > 767) hamburger?.classList.toggle("open");

    if (document.documentElement.getAttribute("data-layout") === "vertical" ||
        document.documentElement.getAttribute("data-layout") === "semibox") {
      if (sidebarVisibilitytype === "show") {
        if (windowSize < 1025 && windowSize > 767) {
          document.body.classList.remove("vertical-sidebar-enable");
          document.documentElement.setAttribute(
            "data-sidebar-size",
            document.documentElement.getAttribute("data-sidebar-size") === "sm" ? "" : "sm"
          );
        } else if (windowSize > 1025) {
          document.body.classList.remove("vertical-sidebar-enable");
          document.documentElement.setAttribute(
            "data-sidebar-size",
            document.documentElement.getAttribute("data-sidebar-size") === "lg" ? "sm" : "lg"
          );
        } else {
          document.body.classList.add("vertical-sidebar-enable");
          document.documentElement.setAttribute("data-sidebar-size", "lg");
        }
      }
    }
  };

  return (
    <header id="page-topbar" className={headerClass}>
      <div className="layout-width">
        <div className="navbar-header">
          <div className="d-flex align-items-center">
            <div className="navbar-brand-box horizontal-logo">
              <Link href="/apps-cms" className="logo logo-dark" aria-label="Velzon CMS">
                <span className="logo-sm">
                  <Image src={logoSm} width={28} height={28} alt="Velzon CMS" />
                </span>
                <span className="logo-lg">
                  <Image src={logoDark} width={120} height={26} alt="Velzon CMS" />
                </span>
              </Link>
            </div>

            <button
              onClick={toggleMenu}
              type="button"
              className="btn btn-sm px-3 fs-16 header-item vertical-menu-btn topnav-hamburger"
              id="topnav-hamburger-icon"
              aria-label="Toggle navigation"
            >
              <span className="hamburger-icon">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
          </div>

          <div className="d-flex align-items-center">
            <LanguageDropdown />
            <LightDark
              layoutMode={layoutModeType}
              onChangeLayoutMode={onChangeLayoutMode}
            />
            <ProfileDropdown />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
