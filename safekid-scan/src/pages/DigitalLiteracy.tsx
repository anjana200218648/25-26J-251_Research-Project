import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { TrendingUp, Smartphone, Monitor, Users, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';

const DigitalLiteracy = () => {
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
            <div className="p-4 bg-purple-100 rounded-full">
              <TrendingUp className="h-12 w-12 text-purple-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Digital Literacy Tips</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Age-appropriate guidelines and best practices for safe and responsible social media use across different platforms
          </p>
        </div>

        {/* Platform Categories */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardHeader>
              <div className="p-3 bg-blue-100 rounded-full w-fit mb-4">
                <Smartphone className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-xl font-semibold">Mobile Apps</CardTitle>
              <CardDescription>Smartphone and tablet applications</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>TikTok, Instagram, Snapchat</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Messaging apps (WhatsApp, Discord)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Gaming platforms</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Photo sharing apps</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardHeader>
              <div className="p-3 bg-green-100 rounded-full w-fit mb-4">
                <Monitor className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-xl font-semibold">Social Networks</CardTitle>
              <CardDescription>Desktop and web-based platforms</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Facebook, Twitter/X</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>YouTube, Vimeo</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>LinkedIn, professional networks</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Online forums and communities</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardHeader>
              <div className="p-3 bg-purple-100 rounded-full w-fit mb-4">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle className="text-xl font-semibold">Communication Tools</CardTitle>
              <CardDescription>Chat and collaboration platforms</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Video calling (Zoom, Skype)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Group messaging platforms</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Educational collaboration tools</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Online learning platforms</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Age-Specific Guidelines */}
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-gray-900">Age-Appropriate Guidelines</CardTitle>
              <CardDescription>Platform recommendations and safety rules by age group</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Ages 8-12 */}
                <div className="border-l-4 border-blue-500 pl-6">
                  <h3 className="text-xl font-semibold text-blue-900 mb-3">Ages 8-12: Basic Supervision Required</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Recommended Platforms</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Kid-friendly social media (with parental controls)</li>
                        <li>• Educational apps and games</li>
                        <li>• Family communication tools</li>
                        <li>• Supervised video sharing</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Safety Rules</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Parent must approve all friend requests</li>
                        <li>• No sharing personal information</li>
                        <li>• Daily activity monitoring required</li>
                        <li>• Limited to 1 hour per day</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Ages 13-15 */}
                <div className="border-l-4 border-purple-500 pl-6">
                  <h3 className="text-xl font-semibold text-purple-900 mb-3">Ages 13-15: Guided Independence</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Recommended Platforms</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Instagram, TikTok (with privacy settings)</li>
                        <li>• Snapchat for close friends</li>
                        <li>• Discord for school groups</li>
                        <li>• YouTube for educational content</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Safety Rules</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Private accounts only</li>
                        <li>• Regular privacy setting reviews</li>
                        <li>• No meeting online friends in person</li>
                        <li>• Report and block inappropriate content</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Ages 16+ */}
                <div className="border-l-4 border-green-500 pl-6">
                  <h3 className="text-xl font-semibold text-green-900 mb-3">Ages 16+: Independent Use with Guidance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Recommended Platforms</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• All major social media platforms</li>
                        <li>• Professional networking sites</li>
                        <li>• Online collaboration tools</li>
                        <li>• News and information sources</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Safety Rules</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Strong privacy settings maintained</li>
                        <li>• Digital footprint awareness</li>
                        <li>• Critical thinking about online content</li>
                        <li>• Responsible content creation</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-gray-900">Digital Citizenship Skills</CardTitle>
              <CardDescription>Essential skills for responsible online behavior</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="p-3 bg-blue-100 rounded-full w-fit mx-auto mb-3">
                    <CheckCircle className="h-6 w-6 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-blue-900 mb-2">Respect</h4>
                  <p className="text-sm text-blue-700">Treat others online as you would in person</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="p-3 bg-green-100 rounded-full w-fit mx-auto mb-3">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <h4 className="font-semibold text-green-900 mb-2">Empathy</h4>
                  <p className="text-sm text-green-700">Consider how your words affect others</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="p-3 bg-purple-100 rounded-full w-fit mx-auto mb-3">
                    <AlertTriangle className="h-6 w-6 text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-purple-900 mb-2">Critical Thinking</h4>
                  <p className="text-sm text-purple-700">Question information and sources</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="p-3 bg-orange-100 rounded-full w-fit mx-auto mb-3">
                    <TrendingUp className="h-6 w-6 text-orange-600" />
                  </div>
                  <h4 className="font-semibold text-orange-900 mb-2">Responsibility</h4>
                  <p className="text-sm text-orange-700">Own your digital footprint</p>
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
              onClick={() => navigate('/resources/safety-guide')}
            >
              View Safety Guide
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DigitalLiteracy;