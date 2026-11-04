import React from "react";
import { Col, Container, Row } from "reactstrap";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="footer">
      <Container fluid>
        <Row>
          <Col sm={6}>
            {new Date().getFullYear()} © Velzon Enterprise CMS.
          </Col>
          <Col sm={6}>
            <div className="text-sm-end d-none d-sm-block">
              {t("Enterprise content management")}
            </div>
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer;
