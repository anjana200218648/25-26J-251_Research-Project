import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Shield, AlertTriangle, Eye, Lock, Users, MessageSquare, ArrowLeft, CheckCircle } from 'lucide-react';

const SafetyGuide = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="container mx-auto px-4 py-8 sm:px-6">
        {/* Back Button */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-blue-100 rounded-full">
              <Shield className="h-12 w-12 text-blue-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Social Media Safety Guide</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Protect your children from online threats with comprehensive safety strategies and best practices
          </p>
        </div>

        {/* Key Safety Topics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardHeader>
              <div className="p-3 bg-red-100 rounded-full w-fit mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-xl font-semibold">Recognizing Online Threats</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Predator identification</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Scams and phishing attempts</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Inappropriate content exposure</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardHeader>
              <div className="p-3 bg-blue-100 rounded-full w-fit mb-4">
                <Eye className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-xl font-semibold">Privacy Protection</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Private account settings</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Location sharing controls</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Personal information limits</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Profile visibility settings</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardHeader>
              <div className="p-3 bg-green-100 rounded-full w-fit mb-4">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-xl font-semibold">Communication Guidelines</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Stranger danger online</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Appropriate sharing boundaries</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Reporting suspicious behavior</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Emergency contact procedures</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Safety Tips */}
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-gray-900">Essential Safety Practices</CardTitle>
              <CardDescription>Key steps every parent should implement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Daily Monitoring</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li>• Regularly check your child's online activity</li>
                    <li>• Review friend lists and followers</li>
                    <li>• Monitor app usage and screen time</li>
                    <li>• Discuss online experiences daily</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Device Security</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li>• Enable parental controls on all devices</li>
                    <li>• Use strong, unique passwords</li>
                    <li>• Keep software and apps updated</li>
                    <li>• Install reputable security software</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-gray-900">Age-Appropriate Guidelines</CardTitle>
              <CardDescription>Tailored recommendations by age group</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="bg-blue-50 p-4 rounded-lg mb-4">
                    <h4 className="font-semibold text-blue-900">Ages 8-12</h4>
                    <p className="text-sm text-blue-700 mt-2">Basic supervision required</p>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Parent-approved friends only</li>
                    <li>• No personal information sharing</li>
                    <li>• Daily activity reviews</li>
                    <li>• Limited screen time</li>
                  </ul>
                </div>
                <div className="text-center">
                  <div className="bg-purple-50 p-4 rounded-lg mb-4">
                    <h4 className="font-semibold text-purple-900">Ages 13-15</h4>
                    <p className="text-sm text-purple-700 mt-2">Guided independence</p>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Privacy with oversight</li>
                    <li>• Digital citizenship education</li>
                    <li>• Regular check-ins</li>
                    <li>• Responsible sharing habits</li>
                  </ul>
                </div>
                <div className="text-center">
                  <div className="bg-green-50 p-4 rounded-lg mb-4">
                    <h4 className="font-semibold text-green-900">Ages 16+</h4>
                    <p className="text-sm text-green-700 mt-2">Independent with guidance</p>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Full privacy respect</li>
                    <li>• Advanced safety awareness</li>
                    <li>• Self-monitoring skills</li>
                    <li>• Emergency preparedness</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate('/complaint-form')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Report a Concern
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/resources/digital-literacy')}
            >
              View Digital Literacy Tips
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SafetyGuide;