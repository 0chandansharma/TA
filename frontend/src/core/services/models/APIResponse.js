export default class APIResponse {
    constructor(success, statusCode, data) {
        this.success = success;
        this.statusCode = statusCode;
        this.data = data;
    }
}