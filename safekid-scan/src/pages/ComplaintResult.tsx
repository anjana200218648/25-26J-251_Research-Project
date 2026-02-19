import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Home,
  Download,
  MessageSquare,
  Brain,
  ArrowLeft,
  Shield,
  TrendingUp,
  Activity,
  Heart,
  Eye,
  Zap,
  Award,
  Target,
  ChevronDown,
  ChevronUp,
  Info,
  Star,
  Users,
  Smartphone,
  Timer,
  AlertCircle,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useEffect, useState, useCallback } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ComplaintResult {
  id: string;
  guardian_name: string;
  child_name: string;
  age: number;
  phone_number: string;
  region: string;
  complaint: string;
  risk_level: string;
  risk_probability: number;
  predicted_label: number;
  timestamp: string;
  child_gender: string;
  hours_per_day_on_social_media: number;
  reporter_role: string;
  // Risk scoring fields
  risk_score?: number;
  risk_score_breakdown?: {
    ml_score: number;
    rule_score: number;
    history_score: number;
  };
  triggered_indicators?: string[];
  risk_explanation?: string;
  temporal_data?: TemporalData;
}

interface TemporalTrendData {
  complaint_count: number;
  avg_recent: number;
  avg_baseline: number;
  spike_detected: boolean;
  days_since_first: number;
}

interface TemporalData {
  drift_score: number;
  pattern: string;
  explanation: string;
  trend_data: TemporalTrendData;
}

type RiskLevel = 'low' | 'medium' | 'high';

const normalizeRiskLevel = (rawLevel?: string): RiskLevel => {
  const normalized = (rawLevel || '').toLowerCase();
  if (normalized.includes('high')) return 'high';
  if (normalized.includes('medium')) return 'medium';
  return 'low';
};

// Utility functions for risk assessment - Use backend's risk_level directly
const getRiskColor = (level: string) => {
  switch (level.toLowerCase()) {
    case 'low': return 'text-green-600';
    case 'medium': return 'text-amber-600';
    case 'high': return 'text-red-600';
    default: return 'text-gray-500';
  }
};

const getRiskBgColor = (level: string) => {
  switch (level.toLowerCase()) {
    case 'low': return 'bg-green-50 border-green-200';
    case 'medium': return 'bg-amber-50 border-amber-200';
    case 'high': return 'bg-red-50 border-red-200';
    default: return 'bg-gray-50 border-gray-200';
  }
};

const getRiskIcon = (level: string) => {
  switch (level.toLowerCase()) {
    case 'low': return CheckCircle;
    case 'medium': return AlertCircle;
    case 'high': return AlertTriangle;
    default: return Info;
  }
};

const getRiskGradient = (level: string) => {
  switch (level.toLowerCase()) {
    case 'low': return 'from-green-400 to-emerald-500';
    case 'medium': return 'from-amber-400 to-orange-500';
    case 'high': return 'from-red-500 to-red-600';
    default: return 'from-blue-400 to-indigo-500';
  }
};

const generatePDFReport = (result: ComplaintResult) => {
  const doc = new jsPDF();
  const riskLevel = normalizeRiskLevel(result.risk_level);
  const riskPercentage = (result.risk_probability * 100).toFixed(1);
  const riskScore = result.risk_score || Math.round(result.risk_probability * 100) || 0;
  const confidenceLevel = parseFloat(riskPercentage) >= 80 ? 'Very High' :
                         parseFloat(riskPercentage) >= 60 ? 'High' :
                         parseFloat(riskPercentage) >= 40 ? 'Moderate' : 'Lower';

  // Header with branding
  doc.setFillColor(37, 99, 235); // Blue
  doc.rect(0, 0, 220, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('ChildSafe Risk Assessment Report', 105, 15, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Confidential - Social Media Risk Analysis', 105, 25, { align: 'center' });

  // Report metadata
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Report ID: ${result.id}`, 15, 45);
  doc.text(`Generated: ${new Date().toLocaleString('en-US', { 
    year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true 
  })}`, 15, 50);

  // Risk Assessment Box
  const riskColor: [number, number, number] =
    riskLevel === 'high'
      ? [220, 38, 38]
      : riskLevel === 'medium'
      ? [217, 119, 6]
      : [34, 197, 94];
  doc.setFillColor(riskColor[0], riskColor[1], riskColor[2]);
  doc.roundedRect(15, 60, 180, 25, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const riskText =
    riskLevel === 'high'
      ? 'HIGH RISK DETECTED'
      : riskLevel === 'medium'
      ? 'MEDIUM RISK DETECTED'
      : 'LOW RISK ASSESSMENT';
  doc.text(riskText, 105, 70, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Risk Score: ${result.risk_score || 'N/A'}/100`, 105, 78, { align: 'center' });

  // Guardian Information Section
  let yPos = 95;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Guardian/Parent Information', 15, yPos);
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.line(15, yPos + 2, 195, yPos + 2);
  
  yPos += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  autoTable(doc, {
    startY: yPos,
    head: [['Field', 'Details']],
    body: [
      ['Guardian Name', result.guardian_name],
      ['Phone Number', result.phone_number],
      ['Region', result.region],
      ['Role', result.reporter_role.charAt(0).toUpperCase() + result.reporter_role.slice(1)],
      ['Submitted On', new Date(result.timestamp).toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      }) + ' at ' + new Date(result.timestamp).toLocaleTimeString('en-US', { 
        hour: 'numeric', minute: '2-digit', hour12: true 
      })],
    ],
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
    margin: { left: 15, right: 15 },
  });

  // Child Information Section
  yPos = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Child Information', 15, yPos);
  doc.line(15, yPos + 2, 195, yPos + 2);
  
  yPos += 5;
  autoTable(doc, {
    startY: yPos,
    head: [['Field', 'Details']],
    body: [
      ['Child Name', result.child_name],
      ['Age', `${result.age} years old`],
      ['Gender', result.child_gender === 'M' ? 'Male' : 'Female'],
      ['Daily Social Media Usage', `${result.hours_per_day_on_social_media} hours/day`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
    margin: { left: 15, right: 15 },
  });

  // Complaint Description
  yPos = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Complaint Description', 15, yPos);
  doc.line(15, yPos + 2, 195, yPos + 2);
  
  yPos += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const complaintLines = doc.splitTextToSize(result.complaint, 170);
  doc.text(complaintLines, 15, yPos);

  // Recommendations
  yPos += complaintLines.length * 5 + 10;
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Recommendations', 15, yPos);
  doc.line(15, yPos + 2, 195, yPos + 2);
  
  yPos += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const recommendations = riskLevel === 'high' ? [
    'Seek immediate professional help: Consult a child psychologist or counselor specializing in online safety concerns.',
    'Implement strict parental controls: Use comprehensive monitoring software and set device restrictions immediately.',
    'Limit device access: Temporarily restrict smartphone and internet usage until safety measures are established.',
    'Document all concerns: Keep detailed records of concerning online activities and behaviors for professional consultation.',
    'Family counseling: Involve the entire family in counseling sessions to address underlying issues and improve communication.',
    'Educate about online dangers: Have age-appropriate discussions about cyberbullying, online predators, and digital safety.'
  ] : riskLevel === 'medium' ? [
    'Increase active monitoring: Review daily social media usage and set stricter screen-time limits.',
    'Schedule a counselor check-in: Consider an early consultation if emotional or behavioral signs continue.',
    'Use parental controls: Enable app-level restrictions and content filters on all devices.',
    'Set digital routines: Define no-phone study and sleep hours with consistent family rules.',
    'Track changes weekly: Record behavior, mood, and school impact to identify escalation early.',
    'Strengthen communication: Have non-judgmental conversations about online experiences and peer pressure.'
  ] : [
    'Continue current practices: Maintain existing safety measures and monitoring routines.',
    'Regular check-ins: Schedule periodic discussions about online experiences and any concerns.',
    'Positive reinforcement: Encourage responsible digital citizenship and healthy online habits.',
    'Stay informed: Keep up with current online safety trends and emerging digital risks.',
    'Lead by example: Demonstrate healthy digital habits as a role model for your child.',
    'Build trust: Foster an environment where your child feels comfortable discussing online experiences.'
  ];

  recommendations.forEach((rec, index) => {
    const lines = doc.splitTextToSize(rec, 165);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}.`, 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(lines, 27, yPos);
    yPos += (lines.length * 5) + 2;
    
    // Check if we need a new page
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
  });

  // Add extra space before footer
  if (yPos > 260) {
    doc.addPage();
  }

  // Footer - properly aligned at bottom
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('ChildSafe Risk Assessment System | Confidential Document', 105, 285, { align: 'center' });
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
  }

  // Save PDF
  const filename = `Risk_Assessment_Report_${result.child_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};

const ComplaintResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const result: ComplaintResult | undefined = location.state?.result;
  const [latestResult, setLatestResult] = useState<ComplaintResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['risk-summary']));

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const fetchLatestComplaint = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token found, redirecting to login');
        navigate('/login');
        return;
      }

      console.log('Fetching latest complaint from:', `${API_BASE_URL}/api/complaints/latest`);
      const response = await fetch(`${API_BASE_URL}/api/complaints/latest`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Latest complaint data:', data);
        setLatestResult(data);
      } else if (response.status === 404) {
        console.log('No complaints found (404)');
        setLatestResult(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        setError(errorData?.error || errorData?.message || `HTTP ${response.status}`);
      }
    } catch (err) {
      console.error('Network error:', err);
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!result) {
      fetchLatestComplaint();
    }
    // Set default expanded sections
    setExpandedSections(new Set(['child-info', 'usage-info', 'temporal-drift', 'complaint-details']));
  }, [result, fetchLatestComplaint]);

  // Use the passed result or the fetched latest result
  const displayResult = result || latestResult;
  const riskScore = displayResult?.risk_score || Math.round(displayResult?.risk_probability * 100) || 0;
  
  const riskLevel = normalizeRiskLevel(displayResult?.risk_level);
  const temporalData = displayResult?.temporal_data;
  const hasTemporalData = !!temporalData;
  const temporalPattern = temporalData?.pattern || 'baseline';
  const temporalDriftScore = temporalData?.drift_score || 0;
  const trendData = temporalData?.trend_data;

  const temporalPatternLabel = (() => {
    switch (temporalPattern) {
      case 'critical_escalation':
        return 'Critical Escalation';
      case 'escalation':
        return 'Escalation';
      case 'stable_high':
        return 'Stable High';
      case 'stable':
        return 'Stable';
      case 'improving':
        return 'Improving';
      default:
        return 'Baseline';
    }
  })();

  const temporalPatternClasses = (() => {
    if (temporalPattern === 'critical_escalation' || temporalPattern === 'escalation') {
      return 'bg-red-100 text-red-700 border-red-200';
    }
    if (temporalPattern === 'improving') {
      return 'bg-green-100 text-green-700 border-green-200';
    }
    if (temporalPattern === 'stable_high') {
      return 'bg-amber-100 text-amber-700 border-amber-200';
    }
    return 'bg-blue-100 text-blue-700 border-blue-200';
  })();
  
  const RiskIcon = getRiskIcon(riskLevel);

  if (!result && isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Analyzing Assessment</h2>
            <p className="text-gray-600">Loading your latest complaint assessment...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!displayResult) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center space-y-8 py-12">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-gray-900">No Assessments Found</h2>
              <p className="text-gray-600 text-lg max-w-md mx-auto">
                You haven't submitted any complaints yet. Start protecting your child by submitting your first assessment.
              </p>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Error: {error}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                onClick={() => navigate('/complaint-form')}
                className="bg-gray-900 hover:bg-gray-800 text-white font-semibold px-6 py-3"
              >
                <Shield className="h-5 w-5 mr-2" />
                Submit First Assessment
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="border-gray-300 hover:bg-gray-50 px-6 py-3"
              >
                <Home className="h-5 w-5 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const riskPercentage = (displayResult.risk_probability * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="space-y-8">
          {/* Enhanced Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Assessment Result
            </h1>
            <p className="text-lg text-gray-600 font-medium">
              For {displayResult.child_name}
            </p>
          </div>

          {/* Enhanced Risk Score Card */}
          <Card className={`p-8 ${getRiskBgColor(riskLevel)} border-2 transition-all duration-500 hover:shadow-2xl relative overflow-hidden`}>
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0" style={{
                backgroundImage: `radial-gradient(circle at 25% 25%, currentColor 2px, transparent 2px)`,
                backgroundSize: '20px 20px'
              }}></div>
            </div>

            <div className="relative z-10 flex flex-col items-center space-y-8">
              {/* Risk Score Circle */}
              <div className="relative group">
                <div className={`flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br ${getRiskGradient(riskLevel)} shadow-2xl ring-4 ring-white/50 transition-transform duration-300 group-hover:scale-105`}>
                  <div className="text-center text-white">
                    <div className="text-5xl font-bold drop-shadow-lg">
                      {riskScore}
                    </div>
                    <div className="text-sm opacity-90">/ 100</div>
                  </div>
                </div>
                <div className={`absolute -right-4 -top-4 rounded-full p-3 ${getRiskBgColor(riskLevel)} border-4 border-white shadow-lg`}>
                  <RiskIcon className={`h-10 w-10 ${getRiskColor(riskLevel)}`} />
                </div>
              </div>

              {/* Risk Assessment Summary */}
              <div className="text-center space-y-3 max-w-md">
                <h2 className={`text-3xl font-bold ${getRiskColor(riskLevel)}`}>
                  {riskLevel === 'high' ? 'High Risk' : riskLevel === 'medium' ? 'Medium Risk' : 'Low Risk'}
                </h2>
                <p className="text-gray-700 text-lg leading-relaxed">
                  {riskLevel === 'high'
                    ? 'High risk detected. Immediate attention and intervention may be required to ensure your child\'s safety.'
                    : riskLevel === 'medium'
                    ? 'Moderate risk detected. Increase monitoring and apply preventive actions to avoid escalation.'
                    : 'Your child appears to be at low risk. Continue monitoring and maintaining open communication.'}
                </p>
                <Badge variant="secondary" className={`px-4 py-2 text-sm font-medium ${getRiskBgColor(riskLevel)} ${getRiskColor(riskLevel)} border-0`}>
                  <Activity className="h-4 w-4 mr-2" />
                  Risk Score: {riskScore}/100
                </Badge>
              </div>
            </div>
          </Card>

          {/* Assessment Details - Expandable Sections */}
          <div className="space-y-4">
            {/* Child & Guardian Information */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
              <button
                onClick={() => toggleSection('child-info')}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50/50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 p-3">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Child & Guardian Information</h3>
                    <p className="text-sm text-gray-600">Personal details and contact information</p>
                  </div>
                </div>
                {expandedSections.has('child-info') ?
                  <ChevronUp className="h-5 w-5 text-gray-500" /> :
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                }
              </button>

              {expandedSections.has('child-info') && (
                <div className="px-6 pb-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-start gap-4 p-4 rounded-xl border bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
                      <div className="rounded-full bg-blue-100 p-3">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Child Name</p>
                        <p className="text-lg font-semibold text-blue-700">{displayResult.child_name}</p>
                        <p className="text-xs text-gray-500 mt-1">{displayResult.child_gender === 'M' ? 'Male' : 'Female'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 rounded-xl border bg-gradient-to-r from-purple-50 to-pink-50 border-purple-100">
                      <div className="rounded-full bg-purple-100 p-3">
                        <Calendar className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Age</p>
                        <p className="text-lg font-semibold text-purple-700">{displayResult.age} years old</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 rounded-xl border bg-gradient-to-r from-green-50 to-emerald-50 border-green-100">
                      <div className="rounded-full bg-green-100 p-3">
                        <User className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Guardian</p>
                        <p className="text-lg font-semibold text-green-700">{displayResult.guardian_name}</p>
                        <p className="text-xs text-gray-500 mt-1 capitalize">{displayResult.reporter_role}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 rounded-xl border bg-gradient-to-r from-orange-50 to-red-50 border-orange-100">
                      <div className="rounded-full bg-orange-100 p-3">
                        <Phone className="h-5 w-5 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Contact</p>
                        <p className="text-lg font-semibold text-orange-700">{displayResult.phone_number}</p>
                        <p className="text-xs text-gray-500 mt-1">{displayResult.region}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Social Media Usage */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
              <button
                onClick={() => toggleSection('usage-info')}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50/50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-indigo-100 p-3">
                    <Smartphone className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Social Media Usage</h3>
                    <p className="text-sm text-gray-600">Device and usage patterns</p>
                  </div>
                </div>
                {expandedSections.has('usage-info') ?
                  <ChevronUp className="h-5 w-5 text-gray-500" /> :
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                }
              </button>

              {expandedSections.has('usage-info') && (
                <div className="px-6 pb-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className={`flex items-start gap-4 p-4 rounded-xl border ${
                      displayResult.hours_per_day_on_social_media >= 8
                        ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200'
                        : displayResult.hours_per_day_on_social_media >= 4
                        ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200'
                        : 'bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-100'
                    }`}>
                      <div className={`rounded-full p-3 ${
                        displayResult.hours_per_day_on_social_media >= 8
                          ? 'bg-red-100'
                          : displayResult.hours_per_day_on_social_media >= 4
                          ? 'bg-yellow-100'
                          : 'bg-indigo-100'
                      }`}>
                        <Timer className={`h-5 w-5 ${
                          displayResult.hours_per_day_on_social_media >= 8
                            ? 'text-red-600'
                            : displayResult.hours_per_day_on_social_media >= 4
                            ? 'text-yellow-600'
                            : 'text-indigo-600'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Daily Usage</p>
                        <p className={`text-lg font-semibold ${
                          displayResult.hours_per_day_on_social_media >= 8
                            ? 'text-red-700'
                            : displayResult.hours_per_day_on_social_media >= 4
                            ? 'text-yellow-700'
                            : 'text-indigo-700'
                        }`}>
                        {displayResult.hours_per_day_on_social_media} hours/day</p>
                        <div className={`mt-2 rounded-full h-2 ${
                          displayResult.hours_per_day_on_social_media >= 8
                            ? 'bg-red-200'
                            : displayResult.hours_per_day_on_social_media >= 4
                            ? 'bg-yellow-200'
                            : 'bg-indigo-200'
                        }`}>
                          <div
                            className={`h-2 rounded-full transition-all duration-1000 ${
                              displayResult.hours_per_day_on_social_media >= 8
                                ? 'bg-red-600'
                                : displayResult.hours_per_day_on_social_media >= 4
                                ? 'bg-yellow-600'
                                : 'bg-indigo-600'
                            }`}
                            style={{ width: `${Math.min((displayResult.hours_per_day_on_social_media / 12) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-gray-500">Recommended: ≤ 2 hours/day</p>
                          {displayResult.hours_per_day_on_social_media >= 8 && (
                            <Badge className="text-xs font-semibold bg-red-500 hover:bg-red-600">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              HIGH USAGE
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Temporal Drift Analysis */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
              <button
                onClick={() => toggleSection('temporal-drift')}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-blue-50/40 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 p-3">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Temporal Drift Analysis</h3>
                    <p className="text-sm text-gray-600">Trend patterns from complaint history</p>
                  </div>
                </div>
                {expandedSections.has('temporal-drift') ?
                  <ChevronUp className="h-5 w-5 text-gray-500" /> :
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                }
              </button>

              {expandedSections.has('temporal-drift') && (
                <div className="px-6 pb-6">
                  <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50 p-5 space-y-5">
                    {!hasTemporalData ? (
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-semibold text-blue-800">No history yet</p>
                          <p className="text-sm text-blue-700">First complaint detected. Temporal trend analysis will appear after more submissions.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge className={`border ${temporalPatternClasses}`}>
                            <Activity className="h-3.5 w-3.5 mr-1" />
                            {temporalPatternLabel}
                          </Badge>
                          <Badge className={`border ${temporalDriftScore >= 0 ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                            {temporalDriftScore >= 0 ? '+' : ''}{temporalDriftScore} Temporal Points
                          </Badge>
                        </div>

                        <div className="p-4 rounded-lg bg-white/70 border border-blue-100">
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {temporalData.explanation}
                          </p>
                        </div>

                        {trendData && (
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="p-4 rounded-lg border border-blue-100 bg-white/80">
                              <p className="text-xs text-gray-500">Total Complaints</p>
                              <p className="text-xl font-bold text-blue-700">{trendData.complaint_count}</p>
                            </div>
                            <div className="p-4 rounded-lg border border-blue-100 bg-white/80">
                              <p className="text-xs text-gray-500">Recent Avg (7d)</p>
                              <p className="text-xl font-bold text-sky-700">{trendData.avg_recent.toFixed(1)}</p>
                            </div>
                            <div className="p-4 rounded-lg border border-blue-100 bg-white/80">
                              <p className="text-xs text-gray-500">Baseline Avg (30d)</p>
                              <p className="text-xl font-bold text-indigo-700">{trendData.avg_baseline.toFixed(1)}</p>
                            </div>
                            <div className="p-4 rounded-lg border border-blue-100 bg-white/80">
                              <p className="text-xs text-gray-500">Spike Detection</p>
                              <p className={`text-xl font-bold ${trendData.spike_detected ? 'text-red-600' : 'text-green-600'}`}>
                                {trendData.spike_detected ? 'Detected' : 'None'}
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {/* Complaint Description */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
              <button
                onClick={() => toggleSection('complaint-details')}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50/50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-amber-100 p-3">
                    <MessageSquare className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Complaint Description</h3>
                    <p className="text-sm text-gray-600">Detailed concern description</p>
                  </div>
                </div>
                {expandedSections.has('complaint-details') ?
                  <ChevronUp className="h-5 w-5 text-gray-500" /> :
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                }
              </button>

              {expandedSections.has('complaint-details') && (
                <div className="px-6 pb-6">
                  <div className="p-6 rounded-xl border bg-gradient-to-r from-amber-50 to-orange-50 border-amber-100">
                    <div className="flex items-start gap-4">
                      <div className="rounded-full bg-amber-100 p-3">
                        <FileText className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 mb-3">Concern Details</p>
                        <p className="text-gray-700 leading-relaxed text-lg">
                          {displayResult.complaint}
                        </p>
                        <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>Submitted {new Date(displayResult.timestamp).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{displayResult.region}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Recommendations */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
              <button
                onClick={() => toggleSection('ai-analysis')}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50/50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-gradient-to-r from-purple-100 to-pink-100 p-3">
                    <Target className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Recommendations</h3>
                    <p className="text-sm text-gray-600">Actionable advice based on the assessment</p>
                  </div>
                </div>
                {expandedSections.has('ai-analysis') ?
                  <ChevronUp className="h-5 w-5 text-gray-500" /> :
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                }
              </button>

              {expandedSections.has('ai-analysis') && (
                <div className="px-6 pb-6 space-y-6">
                  {/* Recommendations */}
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-6">
                      <ul className="space-y-3 text-gray-700">
                        {riskLevel === 'high' ? (
                          <>
                            <li className="flex items-start gap-3">
                              <span className="text-red-500 font-bold">•</span>
                              <span><strong>Seek immediate professional help:</strong> Consult a child psychologist or counselor specializing in online safety concerns.</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="text-red-500 font-bold">•</span>
                              <span><strong>Implement strict parental controls:</strong> Use comprehensive monitoring software and set device restrictions immediately.</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="text-red-500 font-bold">•</span>
                              <span><strong>Limit device access:</strong> Temporarily restrict smartphone and internet usage until safety measures are established.</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="text-red-500 font-bold">•</span>
                              <span><strong>Document all concerns:</strong> Keep detailed records of concerning online activities and behaviors for professional consultation.</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="text-red-500 font-bold">•</span>
                              <span><strong>Family counseling:</strong> Involve the entire family in counseling sessions to address underlying issues and improve communication.</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="text-red-500 font-bold">•</span>
                              <span><strong>Educate about online dangers:</strong> Have age-appropriate discussions about cyberbullying, online predators, and digital safety.</span>
                            </li>
                          </>
                        ) : (
                          <>
                            <li className="flex items-start gap-3">
                              <span className="text-green-500 font-bold">•</span>
                              <span><strong>Continue current practices:</strong> Maintain existing safety measures and monitoring routines.</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="text-green-500 font-bold">•</span>
                              <span><strong>Regular check-ins:</strong> Schedule periodic discussions about online experiences and any concerns.</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="text-green-500 font-bold">•</span>
                              <span><strong>Positive reinforcement:</strong> Encourage responsible digital citizenship and healthy online habits.</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="text-green-500 font-bold">•</span>
                              <span><strong>Stay informed:</strong> Keep up with current online safety trends and emerging digital risks.</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="text-green-500 font-bold">•</span>
                              <span><strong>Lead by example:</strong> Demonstrate healthy digital habits as a role model for your child.</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="text-green-500 font-bold">•</span>
                              <span><strong>Build trust:</strong> Foster an environment where your child feels comfortable discussing online experiences.</span>
                            </li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>

                    {/* Enhanced Action Buttons */}
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              onClick={() => generatePDFReport(displayResult)}
              className="flex items-center gap-2 bg-gradient-to-br from-green-500 to-emerald-600 hover:bg-blue-600 text-white font-semibold px-8 py-3 shadow-lg hover:shadow-xl transition-all duration-300 rounded-lg border-0 w-[320px]"
            >
              <Download className="h-5 w-5" />
              <span>Download Report</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate('/upload')}
              className="flex items-center gap-2 border-2 border-blue-200 hover:border-blue-600 hover:bg-blue-600 hover:text-white text-blue-700 font-semibold px-8 py-3 shadow-lg hover:shadow-xl transition-all duration-300 rounded-lg w-[320px]"
            >
              <Home className="h-5 w-5" />
              <span>Upload New Image</span>
            </Button>
          </div>

          {/* Footer */}
          <div className="text-center py-8 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="h-6 w-6 text-blue-600" />
              <span className="text-lg font-semibold text-gray-900">ChildSafe Assessment System</span>
            </div>
            <p className="text-gray-600 text-sm max-w-2xl mx-auto">
              This assessment help protect children from online risks.
              Always combine technology with open communication and parental guidance.
            </p>
            <div className="mt-4 flex items-center justify-center gap-6 text-xs text-gray-500">
              <span>🔒 Secure & Confidential</span>
              <span>📊 Data-Driven Insights</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ComplaintResult;
