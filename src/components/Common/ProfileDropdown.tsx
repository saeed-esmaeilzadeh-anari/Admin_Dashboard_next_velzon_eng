import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import { logoutUser } from "@slices/auth/login/thunk";
import type { AppDispatch } from "@slices/store";
import {
  UncontrolledDropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from "reactstrap";
import { createSelector } from "reselect";
import { useSelector } from "react-redux";
import Image from "next/image";

//import images
const avatar1 = "/images/users/avatar-1.jpg";

const ProfileDropdown = () => {
  const profiledropdownData = createSelector(
    (state: any) => state.Profile,
    user => user.user
  );
  // Inside your component
  const user = useSelector(profiledropdownData);

  const [userName, setUserName] = useState("Admin");

  useEffect(() => {
    const authUSer: any = sessionStorage.getItem("authUser");
    if (authUSer) {
      const obj: any = JSON.parse(authUSer);
      setUserName(
        process.env.NEXT_PUBLIC_DEFAULTAUTH === "fake"
          ? obj.username === undefined
            ? user.first_name || obj.data.first_name || "Admin" // Use || to provide a fallback
            : "Admin"
          : process.env.NEXT_PUBLIC_DEFAULTAUTH === "firebase"
            ? obj.email || "Admin" // Use || to provide a fallback
            : "Admin"
      );
    }
  }, [userName, user]);

  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const handleLogout = () => {
    dispatch(logoutUser());
    router.push("/auth/login");
  };
  return (
    <React.Fragment>
      <UncontrolledDropdown
        nav
        inNavbar
        className="ms-sm-3 header-item topbar-user"
      >
        <DropdownToggle tag="button" type="button" className="btn">
          <span className="d-flex align-items-center">
            <Image
              className="rounded-circle header-profile-user"
              src={avatar1}
              alt="Header Avatar"
              width={40}
              height={40}
            />
            <span className="text-start ms-xl-2">
              <span className="d-none d-xl-inline-block ms-1 fw-medium user-name-text">
                {" "}
                {userName || "Admin"}
              </span>
              <span className="d-none d-xl-block ms-1 fs-12 text-muted user-name-sub-text">
                Founder
              </span>
            </span>
          </span>
        </DropdownToggle>
        <DropdownMenu className="dropdown-menu-end">
          <h6 className="dropdown-header">Welcome {userName}!</h6>
          <DropdownItem className="p-0">
            <Link href="/profile" className="dropdown-item">
              <i className="mdi mdi-account-circle text-muted fs-16 align-middle me-1"></i>
              <span className="align-middle">Profile</span>
            </Link>
          </DropdownItem>
          <DropdownItem className="p-0">
            <Link href="/apps-chat" className="dropdown-item">
              <i className="mdi mdi-message-text-outline text-muted fs-16 align-middle me-1"></i>{" "}
              <span className="align-middle">Messages</span>
            </Link>
          </DropdownItem>
          <DropdownItem className="p-0">
            <Link href={"#"} className="dropdown-item">
              <i className="mdi mdi-calendar-check-outline text-muted fs-16 align-middle me-1"></i>{" "}
              <span className="align-middle">Taskboard</span>
            </Link>
          </DropdownItem>
          <DropdownItem className="p-0">
            <Link href="/pages-faqs" className="dropdown-item">
              <i className="mdi mdi-lifebuoy text-muted fs-16 align-middle me-1"></i>{" "}
              <span className="align-middle">Help</span>
            </Link>
          </DropdownItem>
          <div className="dropdown-divider"></div>
          <DropdownItem className="p-0">
            <Link href="/pages-profile" className="dropdown-item">
              <i className="mdi mdi-wallet text-muted fs-16 align-middle me-1"></i>{" "}
              <span className="align-middle">
                Balance : <b>$5971.67</b>
              </span>
            </Link>
          </DropdownItem>
          <DropdownItem className="p-0">
            <Link href="/pages-profile-settings" className="dropdown-item">
              <span className="badge bg-success-subtle text-success mt-1 float-end">
                New
              </span>
              <i className="mdi mdi-cog-outline text-muted fs-16 align-middle me-1"></i>{" "}
              <span className="align-middle">Settings</span>
            </Link>
          </DropdownItem>
          <DropdownItem className="p-0">
            <Link href="/auth-lockscreen-basic" className="dropdown-item">
              <i className="mdi mdi-lock text-muted fs-16 align-middle me-1"></i>{" "}
              <span className="align-middle">Lock screen</span>
            </Link>
          </DropdownItem>
          <DropdownItem tag="div" className="p-0">
            <button
              type="button"
              onClick={handleLogout}
              className="dropdown-item"
            >
              <i className="mdi mdi-logout text-muted fs-16 align-middle me-1" />{" "}
              <span className="align-middle" data-key="t-logout">
                Logout
              </span>
            </button>
          </DropdownItem>
        </DropdownMenu>
      </UncontrolledDropdown>
    </React.Fragment>
  );
};

export default ProfileDropdown;
