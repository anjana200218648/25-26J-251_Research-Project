import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Phone,
  MapPin,
  Calendar,
  FileText,
  ArrowLeft,
  Home,
} from 'lucide-react';
import { Header } from '@/components/Header';

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
  device_type: string;
  reporter_role: string;
}

const ComplaintResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const result: ComplaintResult | undefined = location.state?.result;

  if (!result) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>No Results Found</CardTitle>
              <CardDescription>Please submit a complaint first</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/complaint-form')}>
                Submit Complaint
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isHighRisk = result.predicted_label === 1;
  const riskPercentage = (result.risk_probability * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Risk Assessment Alert */}
        <Alert
          variant={isHighRisk ? 'destructive' : 'default'}
          className={`mb-6 ${isHighRisk ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}`}
        >
          {isHighRisk ? (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-600" />
          )}
          <AlertTitle className={`text-xl font-bold ${isHighRisk ? 'text-red-800' : 'text-green-800'}`}>
            Risk Level: {result.risk_level}
          </AlertTitle>
          <AlertDescription className={isHighRisk ? 'text-red-700' : 'text-green-700'}>
            {isHighRisk ? (
              <>
                The AI model has identified this case as <strong>high risk</strong> with{' '}
                <strong>{riskPercentage}% confidence</strong>. Immediate attention and intervention
                may be required.
              </>
            ) : (
              <>
                The AI model has identified this case as <strong>low risk</strong> with{' '}
                <strong>{(100 - parseFloat(riskPercentage)).toFixed(1)}% confidence</strong>.
                Continue monitoring and maintain open communication.
              </>
            )}
          </AlertDescription>
        </Alert>

        {/* Main Results Card */}
        <Card className="shadow-xl mb-6">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl font-bold">Assessment Report</CardTitle>
            <CardDescription className="text-blue-50">
              Case ID: {result.id}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Guardian Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3">
                Guardian Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Guardian Name</p>
                    <p className="font-medium">{result.guardian_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Phone Number</p>
                    <p className="font-medium">{result.phone_number}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Region</p>
                    <p className="font-medium">{result.region}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Submitted On</p>
                    <p className="font-medium">
                      {new Date(result.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Child Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3">
                Child Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Child Name</p>
                    <p className="font-medium">{result.child_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Age</p>
                    <p className="font-medium">{result.age} years old</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Gender</p>
                    <p className="font-medium">
                      {result.child_gender === 'M' ? 'Male' : 'Female'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Daily Social Media Usage</p>
                    <p className="font-medium">{result.hours_per_day_on_social_media} hours</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Primary Device</p>
                    <p className="font-medium capitalize">{result.device_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Reporter Role</p>
                    <p className="font-medium capitalize">{result.reporter_role}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Complaint Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3">
                Complaint Description
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700 whitespace-pre-wrap">{result.complaint}</p>
              </div>
            </div>

            {/* Risk Metrics */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3">
                Risk Assessment Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Risk Classification</p>
                  <Badge
                    variant={isHighRisk ? 'destructive' : 'default'}
                    className={`text-lg ${isHighRisk ? 'bg-red-600' : 'bg-green-600'}`}
                  >
                    {result.risk_level}
                  </Badge>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Risk Probability</p>
                  <p className="text-2xl font-bold text-purple-700">{riskPercentage}%</p>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Confidence Score</p>
                  <p className="text-2xl font-bold text-indigo-700">
                    {isHighRisk ? riskPercentage : (100 - parseFloat(riskPercentage)).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-3">
                Recommendations
              </h3>
              <div className={`p-4 rounded-lg ${isHighRisk ? 'bg-red-50' : 'bg-green-50'}`}>
                {isHighRisk ? (
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">⚠️</span>
                      <span>Immediate intervention may be required</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">⚠️</span>
                      <span>Consider professional counseling or support services</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">⚠️</span>
                      <span>Monitor online activities closely</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">⚠️</span>
                      <span>Set clear boundaries and screen time limits</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">⚠️</span>
                      <span>Engage in open communication about online safety</span>
                    </li>
                  </ul>
                ) : (
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-1">✓</span>
                      <span>Continue normal monitoring practices</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-1">✓</span>
                      <span>Maintain open communication with your child</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-1">✓</span>
                      <span>Encourage healthy digital habits</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-1">✓</span>
                      <span>Schedule regular check-ins about online activities</span>
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <Button
            variant="outline"
            onClick={() => navigate('/complaint-form')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Submit Another Complaint
          </Button>
          <Button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Button>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 text-center text-sm text-gray-600 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <p className="font-semibold mb-2">⚠️ Important Disclaimer</p>
          <p>
            This assessment is generated by an AI model and should be used as a supportive tool
            only. It does not replace professional judgment or consultation with qualified experts
            in child psychology, safety, or social work. If you believe a child is in immediate
            danger, please contact local authorities or emergency services.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ComplaintResult;
