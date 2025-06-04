import Constent from './models/AppConstent';
import APIServiceLookUp from './serviceAPI';

export default class ServiceChat {

    lookupService = new APIServiceLookUp();

    async createAssessment(body, token) {
        var serviceType = "POST";
        var url = `${Constent.API_URL}/assessments`;
        var apiService = this.lookupService.getAPIService(serviceType);
        return await apiService.doCall(url, body, token);
    }

    async chatWithAI(body, token, assessmentId) {
        var serviceType = "POST";
        var url = `${Constent.API_URL}/assessments/${assessmentId}/chat`;
        var apiService = this.lookupService.getAPIService(serviceType);
        return await apiService.doCall(url, body, token);
    }

    async chatWithQnAAI(body, token, assessmentId) {
        var serviceType = "POST";
        var url = `${Constent.API_URL}/assessments/${assessmentId}/questionnaires`;
        var apiService = this.lookupService.getAPIService(serviceType);
        return await apiService.doCall(url, body, token);
    }

    async getDashboardSummery(assessmentId, token) {
        var serviceType = "GET";
        var url = `${Constent.API_URL}/assessments/${assessmentId}/dashboardByAssessmentId`;
        var apiService = this.lookupService.getAPIService(serviceType);
        return apiService.doCall(url, {}, token);
    }

    async saveRomData(body, token, assessmentId) {
        var serviceType = "POST";
        var url = `${Constent.API_URL}/assessments/${assessmentId}/rom`;
        var apiService = this.lookupService.getAPIService(serviceType);
        return await apiService.doCall(url, body, token);
    }

    async saveDashboardData(body, token, assessmentId) {
        var serviceType = "POST";
        var url = `${Constent.API_URL}/assessments/${assessmentId}/dashboard`;
        var apiService = this.lookupService.getAPIService(serviceType);
        return await apiService.doCall(url, body, token);
    }
}