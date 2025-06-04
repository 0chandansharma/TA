import axios from 'axios';
import APIResponse from './models/APIResponse';

class ServiceAPI {
    doCall(uri, body, token) { };
}

class GetAPIService extends ServiceAPI {
    async doCall(uri, body, token) {
        var requestHeaders = {
            'Content-type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `bearer ${token}`,
        };
        var response = await axios.get(uri, body, { headers: requestHeaders });
        var main = response.data;
        return new APIResponse(
            main["success"],
            main["statusCode"],
            main["data"],
        );
    }
}

class PostAPIService extends ServiceAPI {
    async doCall(uri, body, token) {
        var requestHeaders = {
            'Content-type': 'application/json',
            // 'Accept': 'application/json',
            // 'Authorization': `bearer ${token}`,
        };
        var response = await axios.post(uri, body, { headers: requestHeaders });
        var main = response.data;
        return new APIResponse(
            main["success"],
            main["statusCode"],
            main["data"],
        );
    }
}

export default class APIServiceLookUp {
    getAPIService(serviceType) {
        if (serviceType === "GET") {
            return new GetAPIService();
        } else {
            return new PostAPIService();
        }
    }
}