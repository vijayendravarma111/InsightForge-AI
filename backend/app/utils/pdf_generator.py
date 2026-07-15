import os
import base64
from datetime import datetime
import matplotlib
matplotlib.use('Agg') # Non-interactive backend
import matplotlib.pyplot as plt
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

class PDFGenerator:
    @staticmethod
    def generate_report_plots(data_profile: dict, forecast_data: dict) -> dict:
        """Generates static chart images using Matplotlib to embed in the PDF."""
        img_dict = {}
        
        # Plot 1: Data Quality Dimensions Bar Chart
        try:
            plt.figure(figsize=(6, 2.5))
            dims = data_profile.get("quality_dimensions", {})
            labels = ["Completeness", "Consistency", "Validity", "Uniqueness", "Accuracy"]
            values = [
                dims.get("completeness", 0),
                dims.get("consistency", 0),
                dims.get("validity", 0),
                dims.get("uniqueness", 0),
                dims.get("accuracy", 0)
            ]
            
            # Dark theme colors for matching dashboard
            colors_list = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']
            
            plt.barh(labels, values, color=colors_list, height=0.6)
            plt.xlim(0, 105)
            plt.title("Data Quality Dimensions (%)", fontsize=10, fontweight='bold', color='#1e293b')
            plt.xlabel("Score (%)", fontsize=8)
            plt.tight_layout()
            
            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=150)
            buf.seek(0)
            img_dict["quality"] = buf
            plt.close()
        except Exception:
            plt.close()

        # Plot 2: Forecast Plot
        try:
            plt.figure(figsize=(6, 3))
            
            hist = forecast_data.get("historical", [])
            fore = forecast_data.get("forecast", [])
            
            hist_dates = [pd.to_datetime(h["date"]) for h in hist]
            hist_sales = [h["sales"] for h in hist]
            
            fore_dates = [pd.to_datetime(f["date"]) for f in fore]
            fore_sales = [f["sales"] for f in fore]
            lower_b = [f.get("lower_bound", 0) for f in fore]
            upper_b = [f.get("upper_bound", 0) for f in fore]
            
            # Limit historical dates to last 18 months for readability
            if len(hist_dates) > 18:
                hist_dates = hist_dates[-18:]
                hist_sales = hist_sales[-18:]
                
            plt.plot(hist_dates, hist_sales, label="Historical Sales", color='#2563eb', linewidth=2)
            plt.plot(fore_dates, fore_sales, label="Forecasted Sales", color='#10b981', linestyle='--', linewidth=2)
            plt.fill_between(fore_dates, lower_b, upper_b, color='#10b981', alpha=0.15, label="95% Confidence Interval")
            
            plt.title("Sales Forecast (Ridge Regression)", fontsize=10, fontweight='bold', color='#1e293b')
            plt.ylabel("Monthly Revenue ($)", fontsize=8)
            plt.legend(loc="upper left", fontsize=7)
            plt.xticks(rotation=25, fontsize=7)
            plt.yticks(fontsize=7)
            plt.grid(True, linestyle=':', alpha=0.6)
            plt.tight_layout()
            
            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=150)
            buf.seek(0)
            img_dict["forecast"] = buf
            plt.close()
        except Exception:
            plt.close()
            
        return img_dict

    @classmethod
    def build_pdf(cls, output_path: str, data_profile: dict, forecast_data: dict, classification_data: dict, anomalies_data: dict, insights_data: dict):
        """Builds the actual ReportLab PDF and writes it to disk."""
        doc = SimpleDocTemplate(
            output_path,
            pagesize=letter,
            rightMargin=0.5*inch, leftMargin=0.5*inch,
            topMargin=0.5*inch, bottomMargin=0.5*inch
        )
        
        # Setup styles
        styles = getSampleStyleSheet()
        
        # Modify existing styles safely to avoid duplicate crashes
        styles['Normal'].textColor = colors.HexColor('#334155')
        
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=26,
            textColor=colors.HexColor('#1e3a8a'),
            alignment=TA_CENTER,
            spaceAfter=15
        )
        
        section_style = ParagraphStyle(
            'ReportSection',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=16,
            textColor=colors.HexColor('#1e40af'),
            spaceBefore=12,
            spaceAfter=8,
            keepWithNext=True
        )
        
        body_style = ParagraphStyle(
            'ReportBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=13,
            spaceAfter=6
        )
        
        bullet_style = ParagraphStyle(
            'ReportBullet',
            parent=body_style,
            leftIndent=15,
            firstLineIndent=-10,
            spaceAfter=4
        )

        story = []
        
        # 1. Header Banner
        story.append(Paragraph("INSIGHTFORGE AI — EXECUTIVE REPORT", title_style))
        story.append(Paragraph(f"<b>Platform Report Generation Date:</b> {datetime.now().strftime('%Y-%m-%d %H:%M')}", body_style))
        story.append(Paragraph(f"<b>Target Dataset Analyzed:</b> {data_profile.get('table_name', 'Superstore Sales').upper()}", body_style))
        story.append(Spacer(1, 10))
        
        # 2. Executive Summary / Rule-Based Insights
        story.append(Paragraph("I. Executive Insights Summary", section_style))
        story.append(Paragraph("The following business findings and actions are generated automatically by the Rule-Based Statistical Insight Engine based on active warehouse aggregations and machine learning outputs.", body_style))
        
        # Render Insights lists
        story.append(Paragraph("<b>Key Findings:</b>", ParagraphStyle('SubKey', parent=body_style, fontName='Helvetica-Bold')))
        for kf in insights_data.get("key_findings", []):
            story.append(Paragraph(f"• {kf}", bullet_style))
            
        story.append(Paragraph("<b>Business Risks:</b>", ParagraphStyle('SubRisk', parent=body_style, fontName='Helvetica-Bold')))
        for br in insights_data.get("business_risks", []):
            story.append(Paragraph(f"• {br}", bullet_style))
            
        story.append(Paragraph("<b>Growth Opportunities:</b>", ParagraphStyle('SubOpp', parent=body_style, fontName='Helvetica-Bold')))
        for opp in insights_data.get("growth_opportunities", []):
            story.append(Paragraph(f"• {opp}", bullet_style))
            
        story.append(Paragraph("<b>Recommended Actions:</b>", ParagraphStyle('SubAct', parent=body_style, fontName='Helvetica-Bold')))
        for act in insights_data.get("recommended_actions", []):
            story.append(Paragraph(f"• {act}", bullet_style))
            
        story.append(Spacer(1, 10))

        # Generate plots
        plots = cls.generate_report_plots(data_profile, forecast_data)

        # 3. Data Quality Report
        story.append(Paragraph("II. Data Warehouse Profiling & Quality Engine", section_style))
        story.append(Paragraph(f"The imported dataset has <b>{data_profile.get('row_count', 0)} rows</b> and <b>{data_profile.get('col_count', 0)} columns</b>. The profiling suite evaluated data reliability across five core metrics.", body_style))
        
        # Embed Quality Chart
        if "quality" in plots:
            story.append(Image(plots["quality"], width=5.5*inch, height=2.29*inch))
            story.append(Spacer(1, 5))
            
        # Quality score values in a table
        dims = data_profile.get("quality_dimensions", {})
        quality_table_data = [
            ["Dimension", "Score (%)", "Status"],
            ["Completeness", f"{dims.get('completeness', 0)}%", "Satisfactory" if dims.get('completeness', 0) >= 95 else "Caution"],
            ["Consistency", f"{dims.get('consistency', 0)}%", "Satisfactory" if dims.get('consistency', 0) >= 90 else "Caution"],
            ["Validity", f"{dims.get('validity', 0)}%", "Satisfactory" if dims.get('validity', 0) >= 95 else "Caution"],
            ["Uniqueness", f"{dims.get('uniqueness', 0)}%", "Satisfactory" if dims.get('uniqueness', 0) >= 95 else "Caution"],
            ["Accuracy", f"{dims.get('accuracy', 0)}%", "Satisfactory" if dims.get('accuracy', 0) >= 90 else "Caution"],
            ["Overall Data Quality Score", f"{dims.get('overall', 0)}%", "Excellent" if dims.get('overall', 0) >= 92 else "Needs Clean"]
        ]
        
        q_table = Table(quality_table_data, colWidths=[2.5*inch, 1.5*inch, 2.0*inch])
        q_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#1e293b')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0,0), (-1,0), 6),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
            ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#eff6ff')),
        ]))
        story.append(q_table)
        story.append(Spacer(1, 10))

        # 4. Machine Learning Forecast & Anomalies
        story.append(Paragraph("III. Machine Learning Predictive Outputs", section_style))
        story.append(Paragraph("InsightForge AI fits classical regression, classifier, and anomaly models to automate sales forecasts, identify high-value customer conversion triggers, and surface order irregularities.", body_style))
        
        # Forecast Image
        if "forecast" in plots:
            story.append(Image(plots["forecast"], width=5.5*inch, height=2.75*inch))
            story.append(Spacer(1, 5))
            
        # Model performance tables
        f_metrics = forecast_data.get("metrics", {})
        c_metrics = classification_data.get("metrics", {})
        
        ml_table_data = [
            ["Model Type", "Target Column / Variable", "Primary Evaluation Metrics"],
            ["Sales Forecast (Ridge)", "Monthly Aggregated Revenue", f"R² Score: {f_metrics.get('r2', 0.0)} | RMSE: {f_metrics.get('rmse', 0.0)}"],
            ["Customer Class (Random Forest)", "High-Value Segment (1/0)", f"F1-Score: {c_metrics.get('f1_score', 0.0)} | Recall: {c_metrics.get('recall', 0.0)}"],
            ["Anomaly Detection (Isolation Forest)", "Sales/Profit/Quantity Outliers", f"Anomaly Count: {anomalies_data.get('anomaly_count', 0)} ({anomalies_data.get('anomaly_rate_pct', 0.0)}% of rows)"]
        ]
        
        ml_table = Table(ml_table_data, colWidths=[2.2*inch, 2.0*inch, 2.8*inch])
        ml_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#1e293b')),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('FONTSIZE', (0,0), (-1,-1), 8),
        ]))
        
        story.append(KeepTogether([ml_table]))
        story.append(Spacer(1, 15))
        story.append(Paragraph("<i>End of Report. Confidential document intended for internal business analysis only. Generated by InsightForge AI.</i>", ParagraphStyle('Footer', parent=body_style, alignment=TA_CENTER, fontName='Helvetica-Oblique', textColor=colors.HexColor('#64748b'))))

        # Build PDF
        doc.build(story)

import pandas as pd # Import required by forecast parsing in plots
