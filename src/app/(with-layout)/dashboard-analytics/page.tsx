"use client";

import React from "react";
import { Col, Container, Row } from "reactstrap";

//import Components
import UpgradeAccountNotise from "@/components/Dashboard/UpgradeAccountNotise";
import UsersByDevice from "@/components/Dashboard/UsersByDevice";
import Widget from "@/components/Dashboard/Widget";
import BreadCrumb from "@/components/Common/BreadCrumb";
import AudiencesMetrics from "@/components/Dashboard/AudiencesMetrics";
import AudiencesSessions from "@/components/Dashboard/AudiencesSessions";
import LiveUsers from "@/components/Dashboard/LiveUsers";
import TopReferrals from "@/components/Dashboard/TopReferrals";
import TopPages from "@/components/Dashboard/TopPages";

export default function DashboardAnalytics() {
  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Analytics" pageTitle="Dashboards" />
          <Row>
            <Col xxl={5}>
              <UpgradeAccountNotise />
              <Widget />
            </Col>
            <LiveUsers />
          </Row>
          <Row>
            <AudiencesMetrics />
            <AudiencesSessions />
          </Row>
          <Row>
            <UsersByDevice />
            <TopReferrals />
            <TopPages />
          </Row>
        </Container>
      </div>
    </React.Fragment>
  );
}
